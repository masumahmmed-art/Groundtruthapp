"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ActualCostRow,
  ActualHoursRow,
  CategoryRow,
  CostType,
  LineItemRow,
  PositionRow,
  ProjectRow,
  RateItemRow,
} from "@/lib/types";
import {
  COST_TYPE_LABELS,
  actualDjcByCategory,
  actualHoursCost,
  categoryTotal,
  directTotal,
  itemLineTotal,
  lineItemEarnedValue,
  totalActualDjc,
  totalActualIjc,
  totalEarnedValue,
} from "@/lib/calc";
import { formatMoney } from "@/lib/units";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ActualsTab({
  project,
  categories,
  items,
  setItems,
  positions,
  actualCosts,
  setActualCosts,
  actualHours,
  setActualHours,
  rates,
  currency,
}: {
  project: ProjectRow;
  categories: CategoryRow[];
  items: LineItemRow[];
  setItems: (updater: (i: LineItemRow[]) => LineItemRow[]) => void;
  positions: PositionRow[];
  actualCosts: ActualCostRow[];
  setActualCosts: (updater: (a: ActualCostRow[]) => ActualCostRow[]) => void;
  actualHours: ActualHoursRow[];
  setActualHours: (updater: (a: ActualHoursRow[]) => ActualHoursRow[]) => void;
  rates: RateItemRow[];
  currency: string;
}) {
  const supabase = createClient();
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";
  const positionName = (id: string | null) => positions.find((p) => p.id === id)?.name || "—";

  // --- Progress (% complete) -> Earned Value ---
  function updateItemLocal(id: string, patch: Partial<LineItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  async function persistItem(id: string, patch: Partial<LineItemRow>) {
    await supabase.from("line_items").update(patch).eq("id", id);
  }
  function changePercentComplete(id: string, value: string) {
    const pct = Math.max(0, Math.min(100, parseFloat(value) || 0));
    updateItemLocal(id, { percent_complete: pct });
    persistItem(id, { percent_complete: pct });
  }

  const budget = useMemo(() => directTotal(rates, items), [rates, items]);
  const earnedValue = useMemo(() => totalEarnedValue(rates, items), [rates, items]);

  // --- Direct Job Cost ledger ---
  const [djcDate, setDjcDate] = useState(todayIso());
  const [djcCategory, setDjcCategory] = useState("");
  const [djcType, setDjcType] = useState<CostType>("labour");
  const [djcAmount, setDjcAmount] = useState("");
  const [djcDesc, setDjcDesc] = useState("");

  async function addActualCost() {
    if (!djcCategory || !djcAmount) return;
    const { data, error } = await supabase
      .from("actual_costs")
      .insert({
        project_id: project.id,
        category_id: djcCategory,
        entry_date: djcDate,
        cost_type: djcType,
        amount: parseFloat(djcAmount) || 0,
        description: djcDesc,
      })
      .select("*")
      .single();
    if (!error && data) {
      setActualCosts((prev) => [data as ActualCostRow, ...prev]);
      setDjcAmount("");
      setDjcDesc("");
    }
  }
  async function removeActualCost(id: string) {
    setActualCosts((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("actual_costs").delete().eq("id", id);
  }

  const totalDjc = useMemo(() => totalActualDjc(actualCosts), [actualCosts]);
  const djcByCategory = useMemo(() => actualDjcByCategory(actualCosts), [actualCosts]);
  const sortedActualCosts = useMemo(
    () => [...actualCosts].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)),
    [actualCosts]
  );

  // --- Indirect Job Cost ledger ---
  const [ijcDate, setIjcDate] = useState(todayIso());
  const [ijcPosition, setIjcPosition] = useState("");
  const [ijcHours, setIjcHours] = useState("");
  const [ijcDesc, setIjcDesc] = useState("");

  async function addActualHours() {
    if (!ijcPosition || !ijcHours) return;
    const { data, error } = await supabase
      .from("actual_hours")
      .insert({
        project_id: project.id,
        position_id: ijcPosition,
        entry_date: ijcDate,
        hours: parseFloat(ijcHours) || 0,
        description: ijcDesc,
      })
      .select("*")
      .single();
    if (!error && data) {
      setActualHours((prev) => [data as ActualHoursRow, ...prev]);
      setIjcHours("");
      setIjcDesc("");
    }
  }
  async function removeActualHours(id: string) {
    setActualHours((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("actual_hours").delete().eq("id", id);
  }

  const totalIjc = useMemo(() => totalActualIjc(actualHours, positions), [actualHours, positions]);
  const sortedActualHours = useMemo(
    () => [...actualHours].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)),
    [actualHours]
  );

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Actuals</h2>
          <div className="meta">Real progress and real spend — % complete for Earned Value, plus the Direct and Indirect Job Cost ledgers.</div>
        </div>
        <div className="stamp">
          Earned Value
          <br />
          <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>{formatMoney(earnedValue, currency)}</span>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="label">Budget (direct cost)</div><div className="value">{formatMoney(budget, currency)}</div><div className="sub">Full estimate, before overhead/margin</div></div>
        <div className="kpi"><div className="label">Earned Value (EV)</div><div className="value">{formatMoney(earnedValue, currency)}</div><div className="sub">Budget × % complete, per line item</div></div>
        <div className="kpi"><div className="label">Actual Cost (AC)</div><div className="value">{formatMoney(totalDjc + totalIjc, currency)}</div><div className="sub">Actual DJC {formatMoney(totalDjc, currency)} + IJC {formatMoney(totalIjc, currency)}</div></div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Progress</h3><span className="hint">% complete per line item drives Earned Value</span></div>
        <div className="hint" style={{ marginBottom: 10 }}>
          Update each line item's % complete as work happens on site. Earned Value (EV) is that line item's full
          budgeted total × its % complete — this is what gets compared against Planned Value (on the Programme tab)
          and Actual Cost (below) for schedule and cost variance.
        </div>
        <div className="card rate-table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Category</th>
                <th className="label-cell">Description</th>
                <th className="num" style={{ width: 110 }}>Budget</th>
                <th className="num" style={{ width: 90 }}>% complete</th>
                <th className="num" style={{ width: 110 }}>Earned Value</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5} className="empty">No line items yet — add some on the Estimate tab first.</td></tr>
              )}
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{categoryName(it.category_id)}</td>
                  <td className="label-cell">{it.description}</td>
                  <td className="num mono">{formatMoney(itemLineTotal(rates, it), currency)}</td>
                  <td className="num">
                    <input
                      type="number" className="mono" min={0} max={100} step={1}
                      value={it.percent_complete ?? 0}
                      onChange={(e) => changePercentComplete(it.id, e.target.value)}
                    /> %
                  </td>
                  <td className="num mono">{formatMoney(lineItemEarnedValue(rates, it), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Direct Job Cost — actual ledger</h3><span className="hint">Labour, Plant, Material, Subcontract</span></div>
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ width: 150 }}>
              <label>Date</label>
              <input type="date" value={djcDate} onChange={(e) => setDjcDate(e.target.value)} />
            </div>
            <div className="field" style={{ width: 200 }}>
              <label>Category</label>
              <select value={djcCategory} onChange={(e) => setDjcCategory(e.target.value)}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 140 }}>
              <label>Cost type</label>
              <select value={djcType} onChange={(e) => setDjcType(e.target.value as CostType)}>
                {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 130 }}>
              <label>Amount</label>
              <input type="number" step="any" min={0} value={djcAmount} onChange={(e) => setDjcAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label>Description (optional)</label>
              <input type="text" value={djcDesc} onChange={(e) => setDjcDesc(e.target.value)} placeholder="Invoice #, timesheet week, etc." />
            </div>
            <button className="btn btn-primary" onClick={addActualCost} disabled={!djcCategory || !djcAmount}>+ Add entry</button>
          </div>
        </div>

        <div className="card rate-table-wrap" style={{ maxHeight: 320, overflowY: "auto", marginBottom: 14 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th style={{ width: 160 }}>Category</th>
                <th style={{ width: 110 }}>Cost type</th>
                <th className="num" style={{ width: 110 }}>Amount</th>
                <th>Description</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedActualCosts.length === 0 && (
                <tr><td colSpan={6} className="empty">No actual costs logged yet.</td></tr>
              )}
              {sortedActualCosts.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{r.entry_date}</td>
                  <td>{categoryName(r.category_id)}</td>
                  <td>{COST_TYPE_LABELS[r.cost_type]}</td>
                  <td className="num mono">{formatMoney(r.amount, currency)}</td>
                  <td>{r.description}</td>
                  <td><button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeActualCost(r.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
          <table>
            <thead>
              <tr>
                <th className="label-cell">Category</th>
                <th className="num" style={{ width: 120 }}>Budget</th>
                <th className="num" style={{ width: 120 }}>Actual to date</th>
                <th className="num" style={{ width: 120 }}>Variance</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const catBudget = categoryTotal(rates, items, c.id);
                const catActual = Object.values(djcByCategory[c.id] || {}).reduce((s, v) => s + v, 0);
                const variance = catBudget - catActual;
                return (
                  <tr key={c.id}>
                    <td className="label-cell">{c.name}</td>
                    <td className="num mono">{formatMoney(catBudget, currency)}</td>
                    <td className="num mono">{formatMoney(catActual, currency)}</td>
                    <td className="num mono" style={{ color: variance < 0 ? "var(--danger, #b3261e)" : undefined }}>
                      {formatMoney(variance, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Indirect Job Cost — actual ledger</h3><span className="hint">Hours worked against each Position</span></div>
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ width: 150 }}>
              <label>Date</label>
              <input type="date" value={ijcDate} onChange={(e) => setIjcDate(e.target.value)} />
            </div>
            <div className="field" style={{ width: 200 }}>
              <label>Position</label>
              <select value={ijcPosition} onChange={(e) => setIjcPosition(e.target.value)}>
                <option value="">Select…</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 110 }}>
              <label>Hours</label>
              <input type="number" step="any" min={0} value={ijcHours} onChange={(e) => setIjcHours(e.target.value)} placeholder="0" />
            </div>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label>Description (optional)</label>
              <input type="text" value={ijcDesc} onChange={(e) => setIjcDesc(e.target.value)} placeholder="Week ending, timesheet ref, etc." />
            </div>
            <button className="btn btn-primary" onClick={addActualHours} disabled={!ijcPosition || !ijcHours}>+ Add entry</button>
          </div>
          {positions.length === 0 && (
            <div className="hint" style={{ marginTop: 10 }}>No positions yet — add some on the Positions tab first.</div>
          )}
        </div>

        <div className="card rate-table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th style={{ width: 160 }}>Position</th>
                <th className="num" style={{ width: 90 }}>Hours</th>
                <th className="num" style={{ width: 110 }}>Cost</th>
                <th>Description</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedActualHours.length === 0 && (
                <tr><td colSpan={6} className="empty">No hours logged yet.</td></tr>
              )}
              {sortedActualHours.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{r.entry_date}</td>
                  <td>{positionName(r.position_id)}</td>
                  <td className="num mono">{r.hours}</td>
                  <td className="num mono">{formatMoney(actualHoursCost(r, positions), currency)}</td>
                  <td>{r.description}</td>
                  <td><button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeActualHours(r.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
