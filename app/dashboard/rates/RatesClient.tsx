"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RateItemRow, RateKind } from "@/lib/types";

const SECTIONS: { key: RateKind; title: string; defaultUnit: string }[] = [
  { key: "labour", title: "Labour", defaultUnit: "hour" },
  { key: "plant", title: "Plant & Equipment", defaultUnit: "hour" },
  { key: "material", title: "Material", defaultUnit: "unit" },
];

export default function RatesClient({
  orgId,
  initialRates,
}: {
  orgId: string;
  initialRates: RateItemRow[];
}) {
  const [rates, setRates] = useState<RateItemRow[]>(initialRates);
  const supabase = createClient();

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
                      Rate ($)
                    </th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        No rates yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
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
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm btn-danger"
                          title="Remove rate"
                          onClick={() => removeRow(r.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
