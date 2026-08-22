"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectRow, RiskCategory, RiskItemRow } from "@/lib/types";
import { fmt0, riskAllowance, totalRiskAllowance, RISK_CATEGORY_LABELS } from "@/lib/calc";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface WeatherResult {
  location: { name: string; state: string | null; country: string | null };
  cycloneZone: boolean;
  yearsCovered: number;
  monthly: { month: number; label: string; avgRainfallMm: number; avgRainyDays: number; avgHotDays: number }[];
  summary: string[];
  suggestedRisk: { category: "weather"; description: string; probability: number } | null;
}

export default function RiskTab({
  project,
  risks,
  setRisks,
}: {
  project: ProjectRow;
  risks: RiskItemRow[];
  setRisks: (updater: (r: RiskItemRow[]) => RiskItemRow[]) => void;
}) {
  const supabase = createClient();
  const [location, setLocation] = useState(project.location || "");
  const [months, setMonths] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WeatherResult | null>(null);

  function toggleMonth(m: number) {
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
  }

  async function checkWeather() {
    if (!location.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({ location });
      if (months.length) qs.set("months", months.join(","));
      const res = await fetch(`/api/weather-risk?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong looking up weather risk.");
      } else {
        setResult(json);
      }
    } catch (e: any) {
      setError(e?.message || "Network error looking up weather risk.");
    } finally {
      setLoading(false);
    }
  }

  async function addRisk(patch?: Partial<RiskItemRow>) {
    const { data, error } = await supabase
      .from("risk_items")
      .insert({
        project_id: project.id,
        category: patch?.category || "other",
        description: patch?.description || "New risk",
        probability: patch?.probability ?? 20,
        impact: patch?.impact ?? 0,
        notes: patch?.notes || "",
        sort_order: risks.length + 1,
      })
      .select("*")
      .single();
    if (!error && data) setRisks((prev) => [...prev, data as RiskItemRow]);
  }

  function updateLocal(id: string, patch: Partial<RiskItemRow>) {
    setRisks((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function persist(id: string, patch: Partial<RiskItemRow>) {
    await supabase.from("risk_items").update(patch).eq("id", id);
  }

  async function removeRisk(id: string) {
    setRisks((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("risk_items").delete().eq("id", id);
  }

  const total = totalRiskAllowance(risks);
  const maxRain = result ? Math.max(...result.monthly.map((m) => m.avgRainfallMm), 1) : 1;

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Risk & Location</h2>
          <div className="meta">Itemised risk register (probability × cost impact) plus a weather-risk lookup for the site.</div>
        </div>
        <div className="stamp">
          Risk allowance
          <br />
          <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>{fmt0.format(total)}</span>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Risk register</h3>
          <button className="btn btn-sm" onClick={() => addRisk()}>+ Add risk</button>
        </div>
        <div className="card rate-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 130 }}>Category</th>
                <th>Description</th>
                <th className="num" style={{ width: 90 }}>Probability</th>
                <th className="num" style={{ width: 110 }}>Cost impact</th>
                <th className="num" style={{ width: 110 }}>Allowance</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {risks.length === 0 && (
                <tr><td colSpan={6} className="empty">No risks logged yet — add one, or use the weather lookup below.</td></tr>
              )}
              {risks.map((r) => (
                <tr key={r.id}>
                  <td>
                    <select
                      value={r.category}
                      onChange={(e) => { updateLocal(r.id, { category: e.target.value as RiskCategory }); persist(r.id, { category: e.target.value as RiskCategory }); }}
                    >
                      {Object.entries(RISK_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.description}
                      onChange={(e) => updateLocal(r.id, { description: e.target.value })}
                      onBlur={(e) => persist(r.id, { description: e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number" className="mono" min={0} max={100} step={1}
                      value={r.probability}
                      onChange={(e) => updateLocal(r.id, { probability: parseFloat(e.target.value) || 0 })}
                      onBlur={(e) => persist(r.id, { probability: parseFloat(e.target.value) || 0 })}
                    /> %
                  </td>
                  <td className="num">
                    <input
                      type="number" className="mono" step="any"
                      value={r.impact}
                      onChange={(e) => updateLocal(r.id, { impact: parseFloat(e.target.value) || 0 })}
                      onBlur={(e) => persist(r.id, { impact: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="num mono">{fmt0.format(riskAllowance(r))}</td>
                  <td><button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeRisk(r.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Weather risk lookup</h3>
          <span className="hint">Live historical climate data via Open-Meteo</span>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label>Site location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Suburb, STATE" />
            </div>
            <button className="btn btn-primary" onClick={checkWeather} disabled={loading}>
              {loading ? "Checking…" : "Check weather risk"}
            </button>
          </div>
          <div className="field" style={{ marginBottom: 4 }}>
            <label>Planned construction months (optional — tailors the suggestion)</label>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {MONTHS.map((label, idx) => {
              const m = idx + 1;
              const active = months.includes(m);
              return (
                <button
                  key={m}
                  className={"btn btn-sm" + (active ? " btn-primary" : "")}
                  onClick={() => toggleMonth(m)}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>

          {error && <div className="auth-error">{error}</div>}

          {result && (
            <div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                <div className="kpi" style={{ flex: "1 1 200px" }}>
                  <div className="label">Location matched</div>
                  <div className="value" style={{ fontSize: 15 }}>{result.location.name}{result.location.state ? `, ${result.location.state}` : ""}</div>
                </div>
                <div className="kpi" style={{ flex: "1 1 200px" }}>
                  <div className="label">Cyclone outlook zone</div>
                  <div className="value" style={{ fontSize: 15 }}>{result.cycloneZone ? "Yes (Nov–Apr)" : "No"}</div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                {result.summary.map((s, i) => (
                  <p key={i} style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 8px" }}>{s}</p>
                ))}
              </div>

              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 90, marginBottom: 6 }}>
                {result.monthly.map((m) => (
                  <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${m.label}: ${m.avgRainfallMm}mm avg`}>
                    <div
                      style={{
                        width: "100%",
                        height: Math.max(4, (m.avgRainfallMm / maxRain) * 70),
                        background: "var(--blueprint)",
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="hint" style={{ marginBottom: 14 }}>Average monthly rainfall (mm), last {result.yearsCovered} years</div>

              {result.suggestedRisk && (
                <button
                  className="btn"
                  onClick={() =>
                    addRisk({
                      category: "weather",
                      description: result.suggestedRisk!.description,
                      probability: result.suggestedRisk!.probability,
                      impact: 0,
                    })
                  }
                >
                  + Add suggested risk to register
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
