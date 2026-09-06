"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ActualCostRow,
  ActualHoursRow,
  CategoryRow,
  LineItemRow,
  PositionRow,
  RateItemRow,
} from "@/lib/types";
import {
  directTotal,
  itemLineTotal,
  lineItemEarnedValue,
  totalActualDjc,
  totalActualIjc,
  totalEarnedValue,
} from "@/lib/calc";
import { formatMoney } from "@/lib/units";

// Progress and Earned Value used to live inside the Actuals tab, but they're
// really a different job: Actuals is where you log what was actually spent
// (DJC/IJC ledgers); this tab is where you record how much work is actually
// done, and see that turned into Earned Value — the figure that, alongside
// Planned Value (Programme tab) and Actual Cost (Actuals tab), drives cost
// and schedule performance (CV, SV, CPI, SPI).
export default function EarnedValueTab({
  categories,
  items,
  setItems,
  positions,
  actualCosts,
  actualHours,
  rates,
  currency,
}: {
  categories: CategoryRow[];
  items: LineItemRow[];
  setItems: (updater: (i: LineItemRow[]) => LineItemRow[]) => void;
  positions: PositionRow[];
  actualCosts: ActualCostRow[];
  actualHours: ActualHoursRow[];
  rates: RateItemRow[];
  currency: string;
}) {
  const supabase = createClient();
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";

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
  const totalDjc = useMemo(() => totalActualDjc(actualCosts), [actualCosts]);
  const totalIjc = useMemo(() => totalActualIjc(actualHours, positions), [actualHours, positions]);
  const actualCost = totalDjc + totalIjc;

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Earned Value</h2>
          <div className="meta">
            Progress recorded on site, turned into Earned Value — the key figure for tracking cost and schedule
            performance against the plan.
          </div>
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
        <div className="kpi"><div className="label">Actual Cost (AC)</div><div className="value">{formatMoney(actualCost, currency)}</div><div className="sub">Actual DJC {formatMoney(totalDjc, currency)} + IJC {formatMoney(totalIjc, currency)} — logged on the Actuals tab</div></div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Progress</h3><span className="hint">% complete per line item drives Earned Value</span></div>
        <div className="hint" style={{ marginBottom: 10 }}>
          Update each line item's % complete as work happens on site. Earned Value (EV) is that line item's full
          budgeted total × its % complete — this is what gets compared against Planned Value (on the Programme tab)
          and Actual Cost (from the Actuals tab) for schedule and cost variance.
        </div>
        <div className="card rate-table-wrap" style={{ maxHeight: 500, overflowY: "auto" }}>
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
    </div>
  );
}
