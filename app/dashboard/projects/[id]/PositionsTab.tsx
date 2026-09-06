"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmploymentType, PositionRow, ProjectRow, RateBasis } from "@/lib/types";
import {
  EMPLOYMENT_TYPE_LABELS,
  RATE_BASIS_LABELS,
  ASSUMED_HOURS_PER_WEEK,
  ASSUMED_WEEKS_PER_YEAR,
  fullyLoadedRate,
  totalWeeklyIndirectCost,
} from "@/lib/calc";
import { formatMoney } from "@/lib/units";

export default function PositionsTab({
  project,
  positions,
  setPositions,
  currency,
}: {
  project: ProjectRow;
  positions: PositionRow[];
  setPositions: (updater: (p: PositionRow[]) => PositionRow[]) => void;
  currency: string;
}) {
  const supabase = createClient();

  async function addPosition() {
    const { data, error } = await supabase
      .from("positions")
      .insert({
        project_id: project.id,
        name: "New position",
        employment_type: "wage",
        rate_basis: "hour",
        base_rate: 0,
        rcm: 1,
        notes: "",
        sort_order: positions.length + 1,
      })
      .select("*")
      .single();
    if (!error && data) setPositions((prev) => [...prev, data as PositionRow]);
  }

  function updateLocal(id: string, patch: Partial<PositionRow>) {
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function persist(id: string, patch: Partial<PositionRow>) {
    await supabase.from("positions").update(patch).eq("id", id);
  }

  function changeEmploymentType(p: PositionRow, next: EmploymentType) {
    // Switching to "wage" locks the multiplier back to 1 - a wage rate is
    // already the true cost, so no stale multiplier should linger.
    const patch: Partial<PositionRow> = { employment_type: next };
    if (next === "wage") patch.rcm = 1;
    updateLocal(p.id, patch);
    persist(p.id, patch);
  }

  async function removePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("positions").delete().eq("id", id);
  }

  const totalWeekly = useMemo(() => totalWeeklyIndirectCost(positions), [positions]);

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Positions</h2>
          <div className="meta">
            The Indirect Job Cost (IJC) register — one row per site/support role, each priced at its true cost.
          </div>
        </div>
        <div className="stamp">
          Total indirect cost
          <br />
          <span className="mono" style={{ fontSize: 16, color: "var(--ink)" }}>
            {formatMoney(totalWeekly, currency)} / week
          </span>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Position register</h3>
          <button className="btn btn-sm" onClick={addPosition}>+ Add position</button>
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          <b>Wage</b> positions (e.g. site labour, hourly staff) are paid a rate that already IS the true cost — no
          multiplier is applied, ever. <b>Salaried</b> positions (e.g. site management, engineers) are paid a fixed
          salary that doesn't cover everything they actually cost — their Reimbursable Cost Multiplier (RCM) loads it
          up into a fully-recovered rate, capturing on-costs like leave, super, insurances, IT access, and site
          facilities. The "Total indirect cost" figure above assumes a {ASSUMED_HOURS_PER_WEEK}-hour week and a{" "}
          {ASSUMED_WEEKS_PER_YEAR}-week year to compare hourly, weekly, and annual positions on one basis.
        </div>
        <div className="card rate-table-wrap">
          <table>
            <thead>
              <tr>
                <th className="label-cell">Position</th>
                <th style={{ width: 120 }}>Employment</th>
                <th style={{ width: 110 }}>Rate basis</th>
                <th className="num" style={{ width: 110 }}>Base rate</th>
                <th className="num" style={{ width: 90 }}>RCM</th>
                <th className="num" style={{ width: 130 }}>Fully-loaded rate</th>
                <th>Notes</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No positions yet — add one to start building the Indirect Job Cost register.
                  </td>
                </tr>
              )}
              {positions.map((p) => {
                const isWage = p.employment_type === "wage";
                return (
                  <tr key={p.id}>
                    <td className="label-cell">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => updateLocal(p.id, { name: e.target.value })}
                        onBlur={(e) => persist(p.id, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={p.employment_type}
                        onChange={(e) => changeEmploymentType(p, e.target.value as EmploymentType)}
                      >
                        {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={p.rate_basis}
                        onChange={(e) => {
                          const v = e.target.value as RateBasis;
                          updateLocal(p.id, { rate_basis: v });
                          persist(p.id, { rate_basis: v });
                        }}
                      >
                        {Object.entries(RATE_BASIS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        type="number" className="mono" step="any" min={0}
                        value={p.base_rate}
                        onChange={(e) => updateLocal(p.id, { base_rate: parseFloat(e.target.value) || 0 })}
                        onBlur={(e) => persist(p.id, { base_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="num">
                      {isWage ? (
                        <span className="mono" title="Wage rates are already the true cost — no multiplier applied.">1.00×</span>
                      ) : (
                        <input
                          type="number" className="mono" step="0.01" min={0}
                          value={p.rcm}
                          onChange={(e) => updateLocal(p.id, { rcm: parseFloat(e.target.value) || 0 })}
                          onBlur={(e) => persist(p.id, { rcm: parseFloat(e.target.value) || 0 })}
                        />
                      )}
                    </td>
                    <td className="num mono">
                      {formatMoney(fullyLoadedRate(p), currency, 2)} {RATE_BASIS_LABELS[p.rate_basis]}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={p.notes}
                        onChange={(e) => updateLocal(p.id, { notes: e.target.value })}
                        onBlur={(e) => persist(p.id, { notes: e.target.value })}
                        placeholder="Optional"
                      />
                    </td>
                    <td><button className="btn btn-ghost btn-sm btn-danger" onClick={() => removePosition(p.id)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
