"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RateItemRow, RateKind } from "@/lib/types";
import { useOrgSettings } from "@/lib/OrgSettingsContext";
import { currencySymbol, formatMoney, convertedDisplay, REGION_BY_CURRENCY } from "@/lib/units";

const SECTIONS: { key: RateKind; title: string; defaultUnit: string }[] = [
  { key: "labour", title: "Labour", defaultUnit: "hour" },
  { key: "plant", title: "Plant & Equipment", defaultUnit: "hour" },
  { key: "material", title: "Material", defaultUnit: "unit" },
];

function webSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export default function RatesClient({
  orgId,
  initialRates,
}: {
  orgId: string;
  initialRates: RateItemRow[];
}) {
  const [rates, setRates] = useState<RateItemRow[]>(initialRates);
  const supabase = createClient();
  const { currency, unitSystem } = useOrgSettings();
  const region = REGION_BY_CURRENCY[currency] || "";

  const [searchQuery, setSearchQuery] = useState("");

  function update(id: string, patch: Partial<RateItemRow>) {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function persist(id: string, patch: Partial<RateItemRow>) {
    await supabase.from("rate_items").update(patch).eq("id", id);
  }

  async function addRow(kind: RateKind, defaultUnit: string) {
    const { data, error } = await supabase
      .from("rate_items")
      .insert({ org_id: orgId, kind, name: "New " + kind + " rate", unit: defaultUnit, rate: 0, sort_order: rates.filter((r) => r.kind === kind).length + 1 })
      .select("*")
      .single();
    if (!error && data) setRates((prev) => [...prev, data as RateItemRow]);
  }

  async function removeRow(id: string) {
    setRates((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("rate_items").delete().eq("id", id);
  }

  function openRowSearch(row: RateItemRow) {
    const q = [row.name, row.unit ? `rate per ${row.unit}` : "rate", region].filter(Boolean).join(" ");
    window.open(webSearchUrl(q), "_blank", "noopener,noreferrer");
  }

  function openFreeSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    window.open(webSearchUrl(q), "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2>Rate Library</h2>
          <div className="meta">Shared across every project in your workspace.</div>
        </div>
      </div>

      <div className="note">
        <span>⚠</span>
        <span>
          <b>Indicative placeholders.</b> Edit every rate below to match your real supplier
          quotes, EBA labour rates and plant hire agreements.
        </span>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <form onSubmit={openFreeSearch} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 320px", minWidth: 220 }}>
            <label>🔎 Search the web for a rate or reference figure</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. typical hire rate for a 20t excavator"
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Search the web
          </button>
        </form>
        <div className="hint" style={{ marginTop: 10 }}>
          Opens a normal web search in a new tab — no AI, no cost, you review the results yourself.
        </div>
      </div>

      {SECTIONS.map((section) => {
        const rows = rates.filter((r) => r.kind === section.key);
        return (
          <div className="section" key={section.key}>
            <div className="section-head">
              <h3>{section.title}</h3>
              <button className="btn btn-sm" onClick={() => addRow(section.key, section.defaultUnit)}>
                + Add {section.title.split(" ")[0].toLowerCase()} rate
              </button>
            </div>
            <div className="card rate-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ width: 110 }}>Unit</th>
                    <th className="num" style={{ width: 130 }}>
                      Rate ({currencySymbol(currency)})
                    </th>
                    <th style={{ width: 44 }}></th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty">
                        No rates yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => {
                    const conv = convertedDisplay(r.unit, unitSystem);
                    return (
                      <tr key={r.id}>
                        <td>
                          <input
                            type="text"
                            value={r.name}
                            onChange={(e) => update(r.id, { name: e.target.value })}
                            onBlur={(e) => persist(r.id, { name: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={r.unit}
                            onChange={(e) => update(r.id, { unit: e.target.value })}
                            onBlur={(e) => persist(r.id, { unit: e.target.value })}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            className="mono"
                            step="0.01"
                            value={r.rate}
                            onChange={(e) => update(r.id, { rate: parseFloat(e.target.value) || 0 })}
                            onBlur={(e) => persist(r.id, { rate: parseFloat(e.target.value) || 0 })}
                          />
                          {conv && (
                            <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>
                              ≈ {formatMoney(r.rate * conv.rateMultiplier, currency, 2)} / {conv.label}
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Search the web for this rate"
                            onClick={() => openRowSearch(r)}
                            type="button"
                          >
                            🔎
                          </button>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm btn-danger" title="Remove rate" onClick={() => removeRow(r.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
