"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow, LineItemRow, Markups, ProjectRow, RateItemRow, RiskItemRow } from "@/lib/types";
import {
  categoryTotal,
  cashFlowSchedule,
  costTypeTotals,
  majorCategoryTotals,
  MAJOR_CATEGORY_PRESETS,
  DASHBOARD_GROUP_COLORS,
  type FullBuildup,
} from "@/lib/calc";
import { formatMoney } from "@/lib/units";

const MAJOR_CATEGORY_DATALIST_ID = "dashboard-major-category-options";

type SectionKey = "majorCategory" | "detailedCategory" | "resourceType" | "cashFlow";

export default function DashboardTab({
  project,
  categories,
  setCategories,
  items,
  rates,
  build,
  currency,
}: {
  project: ProjectRow;
  categories: CategoryRow[];
  setCategories: (updater: (c: CategoryRow[]) => CategoryRow[]) => void;
  items: LineItemRow[];
  risks: RiskItemRow[];
  rates: RateItemRow[];
  build: FullBuildup;
  currency: string;
}) {
  const supabase = createClient();
  const markups = project.markups as Markups;

  // --- Report customisation: which sections show, and which Major
  // Categories are included in the charts. Deliberately not persisted to
  // the database — this is about shaping one printed/exported view at a
  // time, not a saved project setting.
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    majorCategory: true,
    detailedCategory: true,
    resourceType: true,
    cashFlow: true,
  });
  function toggleSection(key: SectionKey) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  function toggleGroup(name: string) {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // --- Major Category mapping (one-time manual setup per project) ---
  const usedMajorCategories = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => {
      if (c.major_category && c.major_category.trim()) set.add(c.major_category.trim());
    });
    return Array.from(set).sort();
  }, [categories]);

  const datalistOptions = useMemo(() => {
    const set = new Set<string>([...MAJOR_CATEGORY_PRESETS, ...usedMajorCategories]);
    return Array.from(set);
  }, [usedMajorCategories]);

  const mappedCount = categories.filter((c) => c.major_category && c.major_category.trim()).length;

  function updateMajorCategoryLocal(id: string, value: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, major_category: value } : c)));
  }
  async function persistMajorCategory(id: string, value: string) {
    await supabase.from("categories").update({ major_category: value || null }).eq("id", id);
  }

  // --- Charts ---
  const majorGroups = useMemo(() => majorCategoryTotals(rates, items, categories), [rates, items, categories]);
  const groupColor = useMemo(() => {
    const map = new Map<string, string>();
    majorGroups.forEach((g, i) => map.set(g.name, DASHBOARD_GROUP_COLORS[i % DASHBOARD_GROUP_COLORS.length]));
    return map;
  }, [majorGroups]);

  const visibleMajorGroups = majorGroups.filter((g) => !hiddenGroups.has(g.name));
  const majorRows = visibleMajorGroups
    .map((g) => ({ name: g.name, color: groupColor.get(g.name) || "var(--ink-faint)", value: g.value }))
    .filter((r) => r.value > 0);
  const majorTotal = majorRows.reduce((s, r) => s + r.value, 0);

  const includedCategoryIds = useMemo(() => {
    const set = new Set<string>();
    visibleMajorGroups.forEach((g) => g.categoryIds.forEach((id) => set.add(id)));
    return set;
  }, [visibleMajorGroups]);

  const detailedCatRows = categories
    .filter((c) => includedCategoryIds.has(c.id))
    .map((c) => ({ name: c.name, color: c.color, value: categoryTotal(rates, items, c.id) }))
    .filter((r) => r.value > 0);
  const detailedCatTotal = detailedCatRows.reduce((s, r) => s + r.value, 0);

  const byType = costTypeTotals(rates, items);
  const typeRows = [
    { name: "Labour", color: "var(--cost-labour)", value: byType.labour },
    { name: "Plant", color: "var(--cost-plant)", value: byType.plant },
    { name: "Material", color: "var(--cost-material)", value: byType.material },
    { name: "Subcontract", color: "var(--cost-subcontract)", value: byType.subcontract },
    {
      name: "Risk, contingency, overhead & margin",
      color: "var(--cost-markup)",
      value: build.risk + build.cont + build.overhead + build.margin,
    },
  ].filter((r) => r.value > 0);
  const typeTotal = typeRows.reduce((s, r) => s + r.value, 0);

  // --- Cash flow (reads the same schedule set on the Summary tab; this
  // panel just offers an optional display window over it, e.g. "just the
  // first 6 months" for a milestone report). ---
  const cashFlowMonths = markups.cashFlowMonths ?? 12;
  const cashFlowRows = useMemo(
    () => cashFlowSchedule(build.totalProjectCost, cashFlowMonths, project.project_date),
    [build.totalProjectCost, cashFlowMonths, project.project_date]
  );
  const maxMonthlySpend = Math.max(1, ...cashFlowRows.map((r) => r.amount));
  const totalMonths = cashFlowRows.length;
  const [viewFrom, setViewFrom] = useState(1);
  const [viewTo, setViewTo] = useState<number | "">("");
  const effectiveFrom = Math.min(Math.max(1, viewFrom || 1), totalMonths);
  const effectiveTo = viewTo === "" || viewTo > totalMonths ? totalMonths : Math.max(effectiveFrom, viewTo);
  const windowedRows = cashFlowRows.slice(effectiveFrom - 1, effectiveTo);

  function StackBar({ rows, total }: { rows: { name: string; color: string; value: number }[]; total: number }) {
    if (!rows.length || total <= 0) return <div className="empty">No costs to show — check your filters above, or add line items in the Estimate tab.</div>;
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

  return (
    <div>
      <datalist id={MAJOR_CATEGORY_DATALIST_ID}>
        {datalistOptions.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>

      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Dashboard</h2>
          <div className="meta">{project.name} · {project.location}</div>
        </div>
        <div className="stamp">{project.project_date}<br />Prepared by {project.prepared_by || "—"}</div>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="label">Direct cost</div><div className="value">{formatMoney(build.direct, currency)}</div><div className="sub">{items.length} priced line items</div></div>
        <div className="kpi"><div className="label">Risk allowance</div><div className="value">{formatMoney(build.risk, currency)}</div><div className="sub">Whole-of-project</div></div>
        <div className="kpi"><div className="label">Contract price</div><div className="value">{formatMoney(build.contractPrice, currency)}</div><div className="sub">Incl. tax — your tender (bid) price</div></div>
        <div className="kpi"><div className="label">Total project cost</div><div className="value">{formatMoney(build.totalProjectCost, currency)}</div><div className="sub">Incl. client's admin cost</div></div>
      </div>

      <div className="section no-print">
        <div className="section-head"><h3>Customise this report</h3><span className="hint">Only affects this screen / the printed PDF — nothing here is saved</span></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--ink-soft)" }}>Sections to show</p>
          <div className="filter-chips">
            <label className={`filter-chip${sections.majorCategory ? "" : " off"}`}>
              <input type="checkbox" checked={sections.majorCategory} onChange={() => toggleSection("majorCategory")} /> Cost by Major Category
            </label>
            <label className={`filter-chip${sections.detailedCategory ? "" : " off"}`}>
              <input type="checkbox" checked={sections.detailedCategory} onChange={() => toggleSection("detailedCategory")} /> Cost by Category (detailed)
            </label>
            <label className={`filter-chip${sections.resourceType ? "" : " off"}`}>
              <input type="checkbox" checked={sections.resourceType} onChange={() => toggleSection("resourceType")} /> Cost by Resource Type
            </label>
            <label className={`filter-chip${sections.cashFlow ? "" : " off"}`}>
              <input type="checkbox" checked={sections.cashFlow} onChange={() => toggleSection("cashFlow")} /> Cash Flow
            </label>
          </div>

          {majorGroups.length > 1 && (
            <>
              <p style={{ margin: "16px 0 8px", fontSize: 12.5, color: "var(--ink-soft)" }}>
                Major Categories to include (filters the two category charts below)
              </p>
              <div className="filter-chips">
                {majorGroups.map((g) => (
                  <label key={g.name} className={`filter-chip${hiddenGroups.has(g.name) ? " off" : ""}`}>
                    <input type="checkbox" checked={!hiddenGroups.has(g.name)} onChange={() => toggleGroup(g.name)} />
                    <span className="sw" style={{ background: groupColor.get(g.name) }}></span>
                    {g.name}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section no-print">
        <div className="section-head">
          <h3>Categorise your categories</h3>
          <span className="hint">{mappedCount} of {categories.length} mapped to a Major Category</span>
        </div>
        <div className="card" style={{ padding: "14px 22px" }}>
          <p style={{ marginTop: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
            A one-time setup: assign each of this project's categories to a higher-level Major Category (Earthworks,
            Drainage, Structures & Bridgework, or your own wording) so the Dashboard can show a rolled-up view instead
            of every individual BOQ category. Pick from the list or type your own — it's remembered for this project.
          </p>
          <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)", maxHeight: 320, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th className="label-cell">Category</th>
                  <th>Major Category</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="label-cell">
                      <span className="sw" style={{ background: c.color, display: "inline-block", width: 9, height: 9, borderRadius: 2, marginRight: 7 }}></span>
                      {c.name}
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <input
                        type="text"
                        list={MAJOR_CATEGORY_DATALIST_ID}
                        placeholder="Unmapped"
                        value={c.major_category || ""}
                        onChange={(e) => updateMajorCategoryLocal(c.id, e.target.value)}
                        onBlur={(e) => persistMajorCategory(c.id, e.target.value)}
                        style={{ width: "100%" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sections.majorCategory && (
        <div className="section">
          <div className="section-head"><h3>Cost by Major Category</h3><span className="hint">Direct cost, rolled up per the mapping above</span></div>
          <div className="card chart-card"><StackBar rows={majorRows} total={majorTotal} /></div>
        </div>
      )}

      {sections.detailedCategory && (
        <div className="section">
          <div className="section-head"><h3>Cost by Category (detailed)</h3><span className="hint">Direct cost only, before markups</span></div>
          <div className="card chart-card"><StackBar rows={detailedCatRows} total={detailedCatTotal} /></div>
        </div>
      )}

      {sections.resourceType && (
        <div className="section">
          <div className="section-head"><h3>Cost by Resource Type</h3><span className="hint">Across the whole estimate</span></div>
          <div className="card chart-card"><StackBar rows={typeRows} total={typeTotal} /></div>
        </div>
      )}

      {sections.cashFlow && (
        <div className="section">
          <div className="section-head"><h3>Cash Flow</h3><span className="hint">An even monthly spread of the total project cost, from the project date</span></div>
          <div className="card" style={{ padding: "18px 22px" }}>
            <div className="no-print" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
              <div className="field" style={{ maxWidth: 140 }}>
                <label>Show from month #</label>
                <input
                  type="number" className="mono" min={1} max={totalMonths}
                  value={viewFrom}
                  onChange={(e) => setViewFrom(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="field" style={{ maxWidth: 140 }}>
                <label>to month #</label>
                <input
                  type="number" className="mono" min={1} max={totalMonths}
                  placeholder={String(totalMonths)}
                  value={viewTo}
                  onChange={(e) => setViewTo(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
                />
              </div>
            </div>
            <p className="hint" style={{ marginBottom: 14 }}>
              A straight-line spread over {totalMonths} month{totalMonths === 1 ? "" : "s"} (set on the Summary tab), not a
              shaped construction curve — use it for a first-pass view of roughly how much is spent per month, not as a
              contractual payment schedule.
            </p>
            <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th></th>
                    <th className="num" style={{ width: 130 }}>Spend</th>
                    <th className="num" style={{ width: 130 }}>Cumulative</th>
                    <th className="num" style={{ width: 70 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {windowedRows.map((row) => (
                    <tr key={row.label}>
                      <td className="label-cell">{row.label}</td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ background: "var(--surface-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${(row.amount / maxMonthlySpend) * 100}%`,
                              height: "100%",
                              background: "var(--blueprint)",
                            }}
                          />
                        </div>
                      </td>
                      <td className="num mono">{formatMoney(row.amount, currency)}</td>
                      <td className="num mono">{formatMoney(row.cumulative, currency)}</td>
                      <td className="num mono">{Math.round(row.cumulativePct)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="section no-print" style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / Save Dashboard PDF</button>
      </div>
    </div>
  );
}
