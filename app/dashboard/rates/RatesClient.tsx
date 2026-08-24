"use client";

import { Fragment, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RateItemRow, RateKind } from "@/lib/types";
import { useOrgSettings } from "@/lib/OrgSettingsContext";
import { currencySymbol, formatMoney, convertedDisplay } from "@/lib/units";

const SECTIONS: { key: RateKind; title: string; defaultUnit: string }[] = [
  { key: "labour", title: "Labour", defaultUnit: "hour" },
  { key: "plant", title: "Plant & Equipment", defaultUnit: "hour" },
  { key: "material", title: "Material", defaultUnit: "unit" },
];

interface Suggestion {
  rate: number;
  unit: string;
  confidence: string;
  note: string;
  sources: { title: string; url: string }[];
}

interface SuggestState {
  loading: boolean;
  error: string | null;
  data: Suggestion | null;
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

  const [suggestions, setSuggestions] = useState<Record<string, SuggestState>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<{ answer: string; sources: { title: string; url: string }[] } | null>(null);

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
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function suggestRate(row: RateItemRow) {
    setSuggestions((prev) => ({ ...prev, [row.id]: { loading: true, error: null, data: null } }));
    try {
      const res = await fetch("/api/rate-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: row.name, unit: row.unit, kind: row.kind, currency }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSuggestions((prev) => ({ ...prev, [row.id]: { loading: false, error: json.error || "Could not get a suggestion.", data: null } }));
      } else {
        setSuggestions((prev) => ({ ...prev, [row.id]: { loading: false, error: null, data: json as Suggestion } }));
      }
    } catch (e: any) {
      setSuggestions((prev) => ({ ...prev, [row.id]: { loading: false, error: e?.message || "Network error.", data: null } }));
    }
  }

  function dismissSuggestion(id: string) {
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function applySuggestion(row: RateItemRow) {
    const suggestion = suggestions[row.id]?.data;
    if (!suggestion) return;
    const patch = { rate: suggestion.rate, unit: suggestion.unit || row.unit };
    update(row.id, patch);
    await persist(row.id, patch);
    dismissSuggestion(row.id);
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: searchQuery, currency }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSearchError(json.error || "Something went wrong running that search.");
      } else {
        setSearchResult(json);
      }
    } catch (e: any) {
      setSearchError(e?.message || "Network error running that search.");
    } finally {
      setSearchLoading(false);
    }
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
        <form onSubmit={runSearch} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 320px", minWidth: 220 }}>
            <label>✨ Ask AI a pricing or reference question</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. typical hire rate for a 20t excavator"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={searchLoading}>
            {searchLoading ? "Searching…" : "Ask AI"}
          </button>
        </form>

        {searchError && <div className="auth-error" style={{ marginTop: 12 }}>{searchError}</div>}

        {searchResult && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--line, #ddd)", paddingTop: 14 }}>
            <p style={{ fontSize: 13, color: "var(--ink)", margin: "0 0 10px" }}>{searchResult.answer}</p>
            {searchResult.sources.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {searchResult.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--blueprint)" }}>
                    {s.title}
                  </a>
                ))}
              </div>
            )}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setSearchResult(null)} type="button">
              Dismiss
            </button>
          </div>
        )}
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
                    const suggestState = suggestions[r.id];
                    const conv = convertedDisplay(r.unit, unitSystem);
                    return (
                      <Fragment key={r.id}>
                        <tr>
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
                              title="Suggest with AI"
                              onClick={() => suggestRate(r)}
                              disabled={suggestState?.loading}
                              type="button"
                            >
                              {suggestState?.loading ? "…" : "✨ AI"}
                            </button>
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-sm btn-danger" title="Remove rate" onClick={() => removeRow(r.id)}>
                              ✕
                            </button>
                          </td>
                        </tr>
                        {suggestState && (suggestState.error || suggestState.data) && (
                          <tr>
                            <td colSpan={5} style={{ padding: 0 }}>
                              <div
                                style={{
                                  background: "var(--paper-soft, #f7f5f0)",
                                  border: "1px solid var(--line, #ddd)",
                                  borderRadius: 6,
                                  padding: 14,
                                  margin: "0 0 10px",
                                }}
                              >
                                {suggestState.error && <div className="auth-error">{suggestState.error}</div>}
                                {suggestState.data && (
                                  <div>
                                    <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
                                      <span className="mono" style={{ fontSize: 16 }}>
                                        {formatMoney(suggestState.data.rate, currency, 2)} / {suggestState.data.unit}
                                      </span>
                                      <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                        {suggestState.data.confidence} confidence
                                      </span>
                                    </div>
                                    {suggestState.data.note && (
                                      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 8px" }}>{suggestState.data.note}</p>
                                    )}
                                    {suggestState.data.sources.length > 0 && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
                                        {suggestState.data.sources.map((s, i) => (
                                          <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--blueprint)" }}>
                                            {s.title}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                    <div style={{ display: "flex", gap: 8 }}>
                                      <button className="btn btn-primary btn-sm" onClick={() => applySuggestion(r)} type="button">
                                        Use this rate
                                      </button>
                                      <button className="btn btn-ghost btn-sm" onClick={() => dismissSuggestion(r.id)} type="button">
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
