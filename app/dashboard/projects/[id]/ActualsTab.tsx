"use client";

import { useMemo } from "react";
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
  rateById,
  totalActualDjc,
  totalActualIjc,
} from "@/lib/calc";
import { formatMoney } from "@/lib/units";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ActualsTab({
  project,
  categories,
  items,
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
  positions: PositionRow[];
  actualCosts: ActualCostRow[];
  setActualCosts: (updater: (a: ActualCostRow[]) => ActualCostRow[]) => void;
  actualHours: ActualHoursRow[];
  setActualHours: (updater: (a: ActualHoursRow[]) => ActualHoursRow[]) => void;
  rates: RateItemRow[];
  currency: string;
}) {
  const supabase = createClient();

  // --- Direct Job Cost ledger ---
  // Every field is editable in place (not just add-then-delete) — the same
  // pattern as the Risk register on the Risk & Location tab. For Labour,
  // Plant, and Material, picking a Rate Library item plus a quantity
  // calculates the amount automatically (hours/qty × that item's rate,
  // exactly like a line item's build-up in the Estimate tab) instead of a
  // typed guess — "Manual amount" is still there as a fallback for anything
  // that doesn't fit a rate item. Subcontract has no rate item to pick from
  // (a subcontractor's invoice isn't priced off the Rate Library), so it's
  // always a typed amount, and its free-text field doubles as an invoice
  // number field.
  function updateCostLocal(id: string, patch: Partial<ActualCostRow>) {
    setActualCosts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  async function persistCost(id: string, patch: Partial<ActualCostRow>) {
    await supabase.from("actual_costs").update(patch).eq("id", id);
  }

  async function addActualCost() {
    const { data, error } = await supabase
      .from("actual_costs")
      .insert({
        project_id: project.id,
        category_id: categories[0]?.id || null,
        entry_date: todayIso(),
        cost_type: "labour",
        rate_item_id: null,
        quantity: 0,
        amount: 0,
        description: "",
      })
      .select("*")
      .single();
    if (!error && data) setActualCosts((prev) => [data as ActualCostRow, ...prev]);
  }

  function changeCostType(row: ActualCostRow, nextType: CostType) {
    // A different cost type has a different (or no) set of matching rate
    // items, so any rate-item link resets — pick a fresh one, or use
    // Manual amount.
    const patch: Partial<ActualCostRow> = { cost_type: nextType, rate_item_id: null, quantity: 0 };
    updateCostLocal(row.id, patch);
    persistCost(row.id, patch);
  }

  function changeRateItem(row: ActualCostRow, rateItemId: string) {
    if (!rateItemId) {
      const patch: Partial<ActualCostRow> = { rate_item_id: null, quantity: 0 };
      updateCostLocal(row.id, patch);
      persistCost(row.id, patch);
      return;
    }
    const rate = rateById(rates, rateItemId);
    const qty = row.quantity || 0;
    const patch: Partial<ActualCostRow> = { rate_item_id: rateItemId, amount: qty * (rate?.rate || 0) };
    updateCostLocal(row.id, patch);
    persistCost(row.id, patch);
  }

  function changeQuantity(row: ActualCostRow, value: string) {
    const qty = parseFloat(value) || 0;
    const rate = row.rate_item_id ? rateById(rates, row.rate_item_id) : undefined;
    const patch: Partial<ActualCostRow> = rate ? { quantity: qty, amount: qty * rate.rate } : { quantity: qty };
    updateCostLocal(row.id, patch);
    persistCost(row.id, patch);
  }

  function changeCostAmount(row: ActualCostRow, value: string) {
    const patch: Partial<ActualCostRow> = { amount: parseFloat(value) || 0 };
    updateCostLocal(row.id, patch);
    persistCost(row.id, patch);
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
  function updateHoursLocal(id: string, patch: Partial<ActualHoursRow>) {
    setActualHours((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  async function persistHours(id: string, patch: Partial<ActualHoursRow>) {
    await supabase.from("actual_hours").update(patch).eq("id", id);
  }

  async function addActualHours() {
    const { data, error } = await supabase
      .from("actual_hours")
      .insert({
        project_id: project.id,
        position_id: positions[0]?.id || null,
        entry_date: todayIso(),
        hours: 0,
        description: "",
      })
      .select("*")
      .single();
    if (!error && data) setActualHours((prev) => [data as ActualHoursRow, ...prev]);
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
          <div className="meta">Real spend — the Direct and Indirect Job Cost ledgers. See the Earned Value tab for progress and cost/schedule performance.</div>
        </div>
        <div className="stamp">
          Total Actual Cost
          <br />
          <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>{formatMoney(totalDjc + totalIjc, currency)}</span>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="label">Direct Job Cost (DJC)</div><div className="value">{formatMoney(totalDjc, currency)}</div><div className="sub">Labour, Plant, Material, Subcontract</div></div>
        <div className="kpi"><div className="label">Indirect Job Cost (IJC)</div><div className="value">{formatMoney(totalIjc, currency)}</div><div className="sub">Hours × each Position's fully-loaded rate</div></div>
        <div className="kpi"><div className="label">Total Actual Cost (AC)</div><div className="value">{formatMoney(totalDjc + totalIjc, currency)}</div><div className="sub">Compared against Earned Value on the Earned Value tab</div></div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Direct Job Cost — actual ledger</h3>
          <button className="btn btn-sm" onClick={addActualCost}>+ Add entry</button>
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          For Labour, Plant, and Material, pick a Rate Library item and a quantity — the amount is calculated from
          the same rates used in the estimate, the same way a line item's build-up works. That calculated amount
          can still be corrected directly if what actually happened differs from the Rate Library (a one-off
          higher rate, a discount, and so on) — just bear in mind that changing the quantity afterwards
          recalculates the amount from the rate again, overwriting a manual correction. Pick "Manual amount"
          instead for anything that doesn't fit a rate item at all. Subcontract is always a typed amount, with its
          description field doubling as an invoice number.
        </div>
        <div className="card rate-table-wrap" style={{ maxHeight: 420, overflowY: "auto", marginBottom: 14 }}>
          <table className="table-fixed">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Date</th>
                <th style={{ width: 170 }}>Category</th>
                <th style={{ width: 110 }}>Cost type</th>
                <th style={{ width: 230 }}>Rate item & quantity</th>
                <th className="num" style={{ width: 110 }}>Amount</th>
                <th style={{ width: 220 }}>{"Description / Invoice #"}</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedActualCosts.length === 0 && (
                <tr><td colSpan={7} className="empty">No actual costs logged yet — click "+ Add entry" above.</td></tr>
              )}
              {sortedActualCosts.map((r) => {
                const matchingRates = rates.filter((rt) => rt.kind === r.cost_type);
                const selectedRate = r.rate_item_id ? rateById(rates, r.rate_item_id) : undefined;
                const isSubcontract = r.cost_type === "subcontract";
                return (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="date"
                        value={r.entry_date}
                        onChange={(e) => { updateCostLocal(r.id, { entry_date: e.target.value }); persistCost(r.id, { entry_date: e.target.value }); }}
                      />
                    </td>
                    <td>
                      <select
                        value={r.category_id || ""}
                        onChange={(e) => { const v = e.target.value || null; updateCostLocal(r.id, { category_id: v }); persistCost(r.id, { category_id: v }); }}
                      >
                        <option value="">Select…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={r.cost_type} onChange={(e) => changeCostType(r, e.target.value as CostType)}>
                        {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {isSubcontract ? (
                        <span className="hint">— priced by invoice, not a rate —</span>
                      ) : (
                        <>
                          <select value={r.rate_item_id || ""} onChange={(e) => changeRateItem(r, e.target.value)} style={{ width: "100%" }}>
                            <option value="">Manual amount</option>
                            {matchingRates.map((rt) => (
                              <option key={rt.id} value={rt.id}>{rt.name} — {formatMoney(rt.rate, currency, 2)}/{rt.unit}</option>
                            ))}
                          </select>
                          {r.rate_item_id && (
                            <input
                              type="number" className="mono" step="any" min={0}
                              style={{ width: "100%", marginTop: 4 }}
                              placeholder={`Qty (${selectedRate?.unit || "unit"})`}
                              value={r.quantity}
                              onChange={(e) => changeQuantity(r, e.target.value)}
                            />
                          )}
                        </>
                      )}
                    </td>
                    <td className="num">
                      <input
                        type="number" className="mono" step="any" min={0}
                        value={r.amount}
                        onChange={(e) => changeCostAmount(r, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={r.description}
                        placeholder={isSubcontract ? "e.g. INV-1042" : "Optional"}
                        onChange={(e) => updateCostLocal(r.id, { description: e.target.value })}
                        onBlur={(e) => persistCost(r.id, { description: e.target.value })}
                      />
                    </td>
                    <td><button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeActualCost(r.id)}>✕</button></td>
                  </tr>
                );
              })}
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
        <div className="section-head">
          <h3>Indirect Job Cost — actual ledger</h3>
          <button className="btn btn-sm" onClick={addActualHours} disabled={positions.length === 0}>+ Add entry</button>
        </div>
        {positions.length === 0 ? (
          <div className="hint" style={{ marginBottom: 10 }}>No positions yet — add some on the Positions tab first.</div>
        ) : (
          <div className="hint" style={{ marginBottom: 10 }}>
            Hours × that position's current fully-loaded rate — the cost isn't typed in, it's always calculated.
          </div>
        )}
        <div className="card rate-table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
          <table className="table-fixed">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Date</th>
                <th style={{ width: 180 }}>Position</th>
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
                  <td>
                    <input
                      type="date"
                      value={r.entry_date}
                      onChange={(e) => { updateHoursLocal(r.id, { entry_date: e.target.value }); persistHours(r.id, { entry_date: e.target.value }); }}
                    />
                  </td>
                  <td>
                    <select
                      value={r.position_id || ""}
                      onChange={(e) => { const v = e.target.value || null; updateHoursLocal(r.id, { position_id: v }); persistHours(r.id, { position_id: v }); }}
                    >
                      <option value="">Select…</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      type="number" className="mono" step="any" min={0}
                      value={r.hours}
                      onChange={(e) => { const h = parseFloat(e.target.value) || 0; updateHoursLocal(r.id, { hours: h }); persistHours(r.id, { hours: h }); }}
                    />
                  </td>
                  <td className="num mono">{formatMoney(actualHoursCost(r, positions), currency)}</td>
                  <td>
                    <input
                      type="text"
                      value={r.description}
                      placeholder="Optional"
                      onChange={(e) => updateHoursLocal(r.id, { description: e.target.value })}
                      onBlur={(e) => persistHours(r.id, { description: e.target.value })}
                    />
                  </td>
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
