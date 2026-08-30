"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow, LineItemRow, Markups, PreliminaryCategory, PreliminaryItem, ProjectRow, RateItemRow, RiskItemRow } from "@/lib/types";
import {
  categoryTotal,
  costTypeTotals,
  fullBuildup,
  preliminaryItemTotal,
  preliminariesBuildupTotal,
  simulateRiskRange,
  RISK_SIMULATION_ITERATIONS,
  PRELIMINARY_CATEGORY_LABELS,
  SITE_STAFF_PRESETS,
  type FullBuildup,
} from "@/lib/calc";
import { formatMoney } from "@/lib/units";

function newPreliminaryId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `pre_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function SummaryTab({
  project,
  setProject,
  categories,
  items,
  risks,
  rates,
  build,
  currency,
}: {
  project: ProjectRow;
  setProject: (updater: (p: ProjectRow) => ProjectRow) => void;
  categories: CategoryRow[];
  items: LineItemRow[];
  risks: RiskItemRow[];
  rates: RateItemRow[];
  build: FullBuildup;
  currency: string;
}) {
  const supabase = createClient();
  const markups = project.markups as Markups;

  function changeMarkup(key: keyof Markups, value: number) {
    const next = { ...markups, [key]: value };
    setProject((p) => ({ ...p, markups: next }));
  }
  async function persistMarkups() {
    await supabase.from("projects").update({ markups }).eq("id", project.id);
  }

  // --- Preliminaries build-up (itemised alternative to the flat % above) ---
  const preliminariesMode = markups.preliminariesMode || "percent";
  const preliminaryItems = markups.preliminariesItems || [];
  const durationWeeks = markups.projectDurationWeeks ?? 12;

  function setMarkupsAndPersist(next: Markups) {
    setProject((p) => ({ ...p, markups: next }));
    supabase.from("projects").update({ markups: next }).eq("id", project.id);
  }

  function setPreliminariesMode(mode: "percent" | "buildup") {
    setMarkupsAndPersist({ ...markups, preliminariesMode: mode });
  }

  function setDurationWeeks(weeks: number) {
    setMarkupsAndPersist({ ...markups, projectDurationWeeks: weeks });
  }

  function addPreliminaryItem(overrides?: Partial<PreliminaryItem>) {
    const item: PreliminaryItem = {
      id: newPreliminaryId(),
      category: "site_management",
      description: "New preliminaries item",
      type: "fixed",
      rate: 0,
      ...overrides,
    };
    setMarkupsAndPersist({ ...markups, preliminariesItems: [...preliminaryItems, item] });
  }

  // --- Quick-add: on-site overhead & staff ---
  // A small form (not just a plain dropdown) so the user builds up the
  // resource — pick or type a role, set its $/week rate — then adds it to
  // the itemised list in one step, as a time-related item under Site
  // management & supervision.
  const [quickRole, setQuickRole] = useState("");
  const [quickCustomRole, setQuickCustomRole] = useState("");
  const [quickRate, setQuickRate] = useState("");

  function handleQuickAddStaff() {
    const description = quickRole === "__custom__" ? quickCustomRole.trim() : quickRole;
    if (!description) return;
    addPreliminaryItem({
      category: "site_management",
      description,
      type: "time_related",
      rate: parseFloat(quickRate) || 0,
    });
    setQuickRole("");
    setQuickCustomRole("");
    setQuickRate("");
  }

  function updatePreliminaryItem(id: string, patch: Partial<PreliminaryItem>) {
    const next = preliminaryItems.map((it) => (it.id === id ? { ...it, ...patch } : it));
    setProject((p) => ({ ...p, markups: { ...markups, preliminariesItems: next } }));
  }

  function persistPreliminaryItems() {
    supabase.from("projects").update({ markups }).eq("id", project.id);
  }

  function removePreliminaryItem(id: string) {
    const next = preliminaryItems.filter((it) => it.id !== id);
    setMarkupsAndPersist({ ...markups, preliminariesItems: next });
  }

  const byType = costTypeTotals(rates, items);
  const catRows = categories
    .map((c) => ({ name: c.name, color: c.color, value: categoryTotal(rates, items, c.id) }))
    .filter((r) => r.value > 0);
  const typeRows = [
    { name: "Labour", color: "var(--cost-labour)", value: byType.labour },
    { name: "Plant", color: "var(--cost-plant)", value: byType.plant },
    { name: "Material", color: "var(--cost-material)", value: byType.material },
    { name: "Risk, contingency, overhead & margin", color: "var(--cost-markup)", value: build.risk + build.cont + build.overhead + build.margin },
  ].filter((r) => r.value > 0);

  // Risk-adjusted price range: rather than blend every risk's probability
  // into one number, simulate many outcomes of "did each risk happen or
  // not" and read off the 10th/90th percentiles, then re-run the same
  // cost cascade at each end. Recomputed only when the risk register or
  // the cost inputs actually change, not on every render.
  const riskRange = useMemo(() => simulateRiskRange(risks), [risks]);
  const buildLow = useMemo(
    () => fullBuildup(rates, items, markups, risks, riskRange.low),
    [rates, items, markups, risks, riskRange.low]
  );
  const buildHigh = useMemo(
    () => fullBuildup(rates, items, markups, risks, riskRange.high),
    [rates, items, markups, risks, riskRange.high]
  );

  function exportCsv() {
    const header = ["Category", "Description", "Unit", "Quantity", `Unit Rate (${currency})`, `Line Total (${currency})`];
    const rows: string[][] = [];
    categories.forEach((cat) => {
      items.filter((i) => i.category_id === cat.id).forEach((it) => {
        const unitRate = (it.labour.concat(it.plant, it.material) as any[]).reduce((sum, c) => {
          const r = rates.find((rr) => rr.id === c.ref);
          return sum + (r ? c.perUnit * r.rate : 0);
        }, 0);
        rows.push([cat.name, it.description, it.unit, String(it.qty), unitRate.toFixed(2), (unitRate * it.qty).toFixed(2)]);
      });
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/[^a-z0-9]+/gi, "_")}_line_items.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function StackBar({ rows, total }: { rows: { name: string; color: string; value: number }[]; total: number }) {
    if (!rows.length || total <= 0) return <div className="empty">No costs yet — add line items in the Estimate tab.</div>;
    return (
      <>
        <div className="stackbar">
          {rows.map((r) => {
            const w = (r.value / total) * 100;
            return (
              <div key={r.name} className="seg" style={{ width: `${w}%`, background: r.color }} title={`${r.name}: ${formatMoney(r.value, currency)}`}>
                {w > 9 && <span>{Math.round(w)}%</span>}
              </div>
            );
          })}
        </div>
        <div className="legend">
          {rows.map((r) => (
            <div className="legend-item" key={r.name}>
              <span className="sw" style={{ background: r.color }}></span>
              {r.name} <b>{formatMoney(r.value, currency)}</b>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Only the flat-percentage markup fields — NOT all of `keyof Markups`, since
  // that now also includes non-numeric fields (preliminariesMode, preliminariesItems)
  // added for the itemised build-up, which can't be bound to a numeric <input>.
  type NumericMarkupKey = "preliminaries" | "contingency" | "overhead" | "margin" | "principalCost" | "gst";

  function MarkupRow({ label, value, mkKey }: { label: string; value: number; mkKey?: NumericMarkupKey }) {
    return (
      <tr>
        <td className="label-cell">{label}</td>
        <td className="num" style={{ width: 110 }}>
          {mkKey && (
            <>
              <input
                type="number" className="mono" step="0.1"
                value={markups[mkKey]}
                onChange={(e) => changeMarkup(mkKey, parseFloat(e.target.value) || 0)}
                onBlur={persistMarkups}
              /> %
            </>
          )}
        </td>
        <td className="num" style={{ width: 130, fontWeight: 600 }}>{formatMoney(value, currency)}</td>
      </tr>
    );
  }

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Estimate Summary</h2>
          <div className="meta">{project.name} · {project.location}</div>
        </div>
        <div className="stamp">{project.project_date}<br />Prepared by {project.prepared_by || "—"}</div>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="label">Direct cost</div><div className="value">{formatMoney(build.direct, currency)}</div><div className="sub">{items.length} priced line items</div></div>
        <div className="kpi"><div className="label">Risk allowance</div><div className="value">{formatMoney(build.risk, currency)}</div><div className="sub">{risks.length} risks in register</div></div>
        <div className="kpi"><div className="label">Contract price</div><div className="value">{formatMoney(build.contractPrice, currency)}</div><div className="sub">Incl. tax — your tender (bid) price</div></div>
        <div className="kpi"><div className="label">Total project cost</div><div className="value">{formatMoney(build.totalProjectCost, currency)}</div><div className="sub">Incl. client's admin cost</div></div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Cost by work category</h3><span className="hint">Direct cost only, before markups</span></div>
        <div className="card chart-card"><StackBar rows={catRows} total={build.direct} /></div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Cost by resource type</h3><span className="hint">Across the whole estimate</span></div>
        <div className="card chart-card"><StackBar rows={typeRows} total={typeRows.reduce((s, r) => s + r.value, 0)} /></div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Risk-adjusted price range</h3>
          <span className="hint">{RISK_SIMULATION_ITERATIONS.toLocaleString()} simulated outcomes of the risk register</span>
        </div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p style={{ marginTop: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
            Each risk in the register either happens, at its stated probability, or it doesn&apos;t — rather than
            blending that into a single number, this simulates many versions of the project and reads off the
            spread. Use it to show a client or tender/bid panel a defensible range, not just one point figure.
          </p>
          <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
            <table className="markup-table">
              <thead>
                <tr>
                  <th className="label-cell">Scenario</th>
                  <th className="num">Risk allowance</th>
                  <th className="num">Contract price</th>
                  <th className="num">Total project cost</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="label-cell">Best case (P10)</td>
                  <td className="num mono">{formatMoney(riskRange.low, currency)}</td>
                  <td className="num mono">{formatMoney(buildLow.contractPrice, currency)}</td>
                  <td className="num mono">{formatMoney(buildLow.totalProjectCost, currency)}</td>
                </tr>
                <tr className="grand-total-row">
                  <td className="label-cell">Expected</td>
                  <td className="num mono">{formatMoney(riskRange.expected, currency)}</td>
                  <td className="num mono">{formatMoney(build.contractPrice, currency)}</td>
                  <td className="num mono">{formatMoney(build.totalProjectCost, currency)}</td>
                </tr>
                <tr>
                  <td className="label-cell">If things go wrong (P90)</td>
                  <td className="num mono">{formatMoney(riskRange.high, currency)}</td>
                  <td className="num mono">{formatMoney(buildHigh.contractPrice, currency)}</td>
                  <td className="num mono">{formatMoney(buildHigh.totalProjectCost, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {risks.length === 0 && (
            <p className="hint" style={{ marginTop: 10 }}>
              Add risks in the Risk &amp; Location tab to see a meaningful range here — with none logged, every
              scenario is the same.
            </p>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Preliminaries</h3><span className="hint">Called General Conditions in the US</span></div>
        <div className="card" style={{ padding: "14px 22px" }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="radio"
                name="prelim-mode"
                checked={preliminariesMode === "percent"}
                onChange={() => setPreliminariesMode("percent")}
              />
              Simple % of direct cost
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="radio"
                name="prelim-mode"
                checked={preliminariesMode === "buildup"}
                onChange={() => setPreliminariesMode("buildup")}
              />
              Itemised build-up
            </label>
          </div>

          {preliminariesMode === "buildup" && (
            <div style={{ marginTop: 14 }}>
              <div className="field" style={{ maxWidth: 220, marginBottom: 14 }}>
                <label>Estimated project duration (weeks)</label>
                <input
                  type="number"
                  className="mono"
                  step="1"
                  min={0}
                  value={durationWeeks}
                  onChange={(e) => setProject((p) => ({ ...p, markups: { ...markups, projectDurationWeeks: parseFloat(e.target.value) || 0 } }))}
                  onBlur={(e) => setDurationWeeks(parseFloat(e.target.value) || 0)}
                />
              </div>
              <p className="hint" style={{ marginBottom: 10 }}>
                Fixed items are a one-off cost. Time-related items are a $/week rate multiplied by the duration above —
                so extending the programme automatically extends items like site supervision or temporary services.
              </p>

              <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)", padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
                  Quick add — on-site overhead &amp; staff
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Role</th>
                      {quickRole === "__custom__" && <th style={{ width: 200 }}>Custom role name</th>}
                      <th style={{ width: 130 }} className="num">$ / week</th>
                      <th style={{ width: 120 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <select value={quickRole} onChange={(e) => setQuickRole(e.target.value)}>
                          <option value="">Select a role…</option>
                          {SITE_STAFF_PRESETS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                          <option value="__custom__">Custom role…</option>
                        </select>
                      </td>
                      {quickRole === "__custom__" && (
                        <td>
                          <input
                            type="text"
                            value={quickCustomRole}
                            onChange={(e) => setQuickCustomRole(e.target.value)}
                            placeholder="e.g. Utilities Coordinator"
                          />
                        </td>
                      )}
                      <td className="num">
                        <input
                          type="number"
                          className="mono"
                          step="0.01"
                          min={0}
                          value={quickRate}
                          onChange={(e) => setQuickRate(e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={handleQuickAddStaff}
                          disabled={!quickRole || (quickRole === "__custom__" && !quickCustomRole.trim())}
                        >
                          + Add to list
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  Pick a common role (or type your own), set its weekly rate, and it's added below as a time-related
                  item under Site management &amp; supervision — ready to fine-tune or re-categorise if needed.
                </p>
              </div>

              <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ width: 190 }}>Category</th>
                      <th style={{ width: 130 }}>Type</th>
                      <th className="num" style={{ width: 120 }}>Rate</th>
                      <th className="num" style={{ width: 120 }}>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preliminaryItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty">No preliminaries items yet — add one below.</td>
                      </tr>
                    )}
                    {preliminaryItems.map((it) => (
                      <tr key={it.id}>
                        <td>
                          <input
                            type="text"
                            value={it.description}
                            onChange={(e) => updatePreliminaryItem(it.id, { description: e.target.value })}
                            onBlur={persistPreliminaryItems}
                          />
                        </td>
                        <td>
                          <select
                            value={it.category}
                            onChange={(e) => { updatePreliminaryItem(it.id, { category: e.target.value as PreliminaryCategory }); persistPreliminaryItems(); }}
                          >
                            {Object.entries(PRELIMINARY_CATEGORY_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={it.type}
                            onChange={(e) => { updatePreliminaryItem(it.id, { type: e.target.value as "fixed" | "time_related" }); persistPreliminaryItems(); }}
                          >
                            <option value="fixed">Fixed</option>
                            <option value="time_related">$/week</option>
                          </select>
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            className="mono"
                            step="0.01"
                            value={it.rate}
                            onChange={(e) => updatePreliminaryItem(it.id, { rate: parseFloat(e.target.value) || 0 })}
                            onBlur={persistPreliminaryItems}
                          />
                        </td>
                        <td className="num mono">{formatMoney(preliminaryItemTotal(it, durationWeeks), currency)}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm btn-danger" title="Remove item" onClick={() => removePreliminaryItem(it.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="grand-total-row">
                      <td className="label-cell" colSpan={4}>Total preliminaries</td>
                      <td className="num mono">{formatMoney(preliminariesBuildupTotal(preliminaryItems, durationWeeks), currency)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => addPreliminaryItem()}>+ Add item</button>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Cost build-up</h3><span className="hint">Editable percentages — applied in sequence</span></div>
        <div className="card" style={{ padding: "6px 22px" }}>
          <table className="markup-table">
            <tbody>
              <MarkupRow label="Direct cost" value={build.direct} />
              {preliminariesMode === "percent" ? (
                <MarkupRow label="Preliminaries" value={build.prelim} mkKey="preliminaries" />
              ) : (
                <tr>
                  <td className="label-cell">Preliminaries <span className="hint">(itemised — edit above)</span></td>
                  <td></td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{formatMoney(build.prelim, currency)}</td>
                </tr>
              )}
              <MarkupRow label="Risk allowance (from register)" value={build.risk} />
              <MarkupRow label="Contingency" value={build.cont} mkKey="contingency" />
              <MarkupRow label="Overhead" value={build.overhead} mkKey="overhead" />
              <MarkupRow label="Margin" value={build.margin} mkKey="margin" />
              <tr><td className="label-cell">Subtotal (ex tax)</td><td></td><td className="num mono" style={{ fontWeight: 600 }}>{formatMoney(build.s3, currency)}</td></tr>
              <MarkupRow label="Tax (GST / VAT / Sales tax)" value={build.gst} mkKey="gst" />
              <tr className="grand-total-row"><td className="label-cell">Contract price</td><td></td><td className="num">{formatMoney(build.contractPrice, currency)}</td></tr>
              <MarkupRow label="Client's administrative cost" value={build.principalCost} mkKey="principalCost" />
              <tr className="grand-total-row"><td className="label-cell">Total project cost</td><td></td><td className="num">{formatMoney(build.totalProjectCost, currency)}</td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>
          &quot;Contract price&quot; is what you would tender or bid — Preliminaries (called General Conditions in the US), Risk, Contingency, Overhead, Margin and tax all sit inside it.
          &quot;Client's administrative cost&quot; (sometimes called the Principal's cost in Australia/UK) is the client's own project management/administration allowance, shown
          separately because it isn't part of your price.
        </p>
      </div>

      <div className="section no-print" style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
        <button className="btn" onClick={exportCsv}>Export line items (CSV)</button>
      </div>
    </div>
  );
}
