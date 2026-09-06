"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow, LineItemRow, ProjectRow, ProgrammeSnapshotCategoryRow, ProgrammeSnapshotRow, RateItemRow } from "@/lib/types";
import { categoryTotal, directTotal, plannedValueSchedule, programmeWindow } from "@/lib/calc";
import { formatMoney } from "@/lib/units";
import ProgrammeImportDialog from "./ProgrammeImportDialog";

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export default function ProgrammeTab({
  project,
  categories,
  setCategories,
  items,
  rates,
  currency,
}: {
  project: ProjectRow;
  categories: CategoryRow[];
  setCategories: (updater: (c: CategoryRow[]) => CategoryRow[]) => void;
  items: LineItemRow[];
  rates: RateItemRow[];
  currency: string;
}) {
  const supabase = createClient();

  // --- Primavera P6 import + snapshot history ---
  const [showImport, setShowImport] = useState(false);
  const [snapshots, setSnapshots] = useState<ProgrammeSnapshotRow[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
  const [snapshotCategories, setSnapshotCategories] = useState<Record<string, ProgrammeSnapshotCategoryRow[]>>({});

  async function refreshSnapshots() {
    setLoadingSnapshots(true);
    const { data } = await supabase
      .from("programme_snapshots")
      .select("*")
      .eq("project_id", project.id)
      .order("imported_at", { ascending: false });
    setSnapshots((data || []) as ProgrammeSnapshotRow[]);
    setLoadingSnapshots(false);
  }

  useEffect(() => {
    refreshSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function toggleSnapshot(id: string) {
    if (expandedSnapshot === id) {
      setExpandedSnapshot(null);
      return;
    }
    setExpandedSnapshot(id);
    if (!snapshotCategories[id]) {
      const { data } = await supabase.from("programme_snapshot_categories").select("*").eq("snapshot_id", id);
      setSnapshotCategories((prev) => ({ ...prev, [id]: (data || []) as ProgrammeSnapshotCategoryRow[] }));
    }
  }

  function updateDateLocal(id: string, field: "planned_start" | "planned_end", value: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value || null } : c)));
  }
  async function persistDate(id: string, field: "planned_start" | "planned_end", value: string) {
    await supabase.from("categories").update({ [field]: value || null }).eq("id", id);
  }
  function changeDate(id: string, field: "planned_start" | "planned_end", value: string) {
    updateDateLocal(id, field, value);
    persistDate(id, field, value);
  }

  const scheduledCount = categories.filter((c) => c.planned_start && c.planned_end).length;
  const progWindow = useMemo(() => programmeWindow(categories), [categories]);
  const totalBudget = useMemo(() => directTotal(rates, items), [rates, items]);
  const windowSpanMs = progWindow ? progWindow.end.getTime() - progWindow.start.getTime() : 0;

  const pvRows = useMemo(() => plannedValueSchedule(rates, items, categories), [rates, items, categories]);
  const maxMonthly = Math.max(1, ...pvRows.map((r) => r.amount));

  // A small rotating palette for Gantt bars — reuses the categories' own
  // colours where set, otherwise a fallback so every row is still visible.
  function barColor(c: CategoryRow, i: number): string {
    return c.color || ["var(--cat-earth)", "var(--cat-pave)", "var(--cat-drain)", "var(--cat-struct)"][i % 4];
  }

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Programme</h2>
          <div className="meta">{project.name} · {project.location}</div>
        </div>
        <div className="stamp">
          {scheduledCount} of {categories.length} categories scheduled
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="label">Total budget</div><div className="value">{formatMoney(totalBudget, currency)}</div><div className="sub">Direct cost across all categories</div></div>
        <div className="kpi">
          <div className="label">Programme window</div>
          <div className="value" style={{ fontSize: 15 }}>{progWindow ? `${fmtDate(progWindow.start)} – ${fmtDate(progWindow.end)}` : "Not set"}</div>
          <div className="sub">Earliest start to latest end</div>
        </div>
        <div className="kpi"><div className="label">Categories scheduled</div><div className="value">{scheduledCount} / {categories.length}</div><div className="sub">Both a start and end date set</div></div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Import from Primavera P6</h3><span className="hint">Re-import monthly to keep the plan current</span></div>
        <div className="card" style={{ padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
            Upload a .xer export to set (or update) each category's planned dates in one go instead of typing them in
            below. Every import is saved as a dated snapshot — see Schedule history further down — so you can compare
            how the programme has moved between imports.
          </p>
          <button className="btn btn-primary" onClick={() => setShowImport(true)}>⇪ Import .xer</button>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Schedule each category</h3><span className="hint">A one-time setup, refine any time as the programme changes</span></div>
        <div className="card" style={{ padding: "14px 22px" }}>
          <p style={{ marginTop: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
            Give each category a planned start and end date so Earned Value can compare progress against a realistic
            time-phased budget instead of an even spread. Any category left unscheduled is still included — its
            budget is simply spread evenly across the whole programme window below until you set its dates.
          </p>
          <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)", maxHeight: 360, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th className="label-cell">Category</th>
                  <th className="num" style={{ width: 130 }}>Budget</th>
                  <th style={{ width: 160 }}>Planned start</th>
                  <th style={{ width: 160 }}>Planned end</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="label-cell">
                      <span className="sw" style={{ background: c.color, display: "inline-block", width: 9, height: 9, borderRadius: 2, marginRight: 7 }}></span>
                      {c.name}
                    </td>
                    <td className="num mono">{formatMoney(categoryTotal(rates, items, c.id), currency)}</td>
                    <td>
                      <input
                        type="date"
                        value={c.planned_start || ""}
                        onChange={(e) => changeDate(c.id, "planned_start", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={c.planned_end || ""}
                        min={c.planned_start || undefined}
                        onChange={(e) => changeDate(c.id, "planned_end", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Gantt view</h3><span className="hint">Each category's planned window, relative to the whole programme</span></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          {!progWindow ? (
            <div className="empty">Set at least one category's start and end date above to see it here.</div>
          ) : (
            <>
              <div className="gantt">
                {categories.map((c, i) => {
                  const s = c.planned_start ? new Date(c.planned_start) : null;
                  const e = c.planned_end ? new Date(c.planned_end) : null;
                  const scheduled = Boolean(s && e && !isNaN(s.getTime()) && !isNaN(e.getTime()));
                  const leftPct = scheduled ? Math.max(0, ((s!.getTime() - progWindow.start.getTime()) / windowSpanMs) * 100) : 0;
                  const widthPct = scheduled ? Math.max(1.5, ((e!.getTime() - s!.getTime()) / windowSpanMs) * 100) : 0;
                  return (
                    <div className="gantt-row" key={c.id}>
                      <div className="gantt-label" title={c.name}>{c.name}</div>
                      <div className="gantt-track">
                        {scheduled ? (
                          <div
                            className="gantt-bar"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: barColor(c, i) }}
                            title={`${c.name}: ${fmtDate(s!)} – ${fmtDate(e!)}`}
                          />
                        ) : (
                          <span className="gantt-unscheduled">Not yet scheduled</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="gantt-axis">
                <span>{fmtDate(progWindow.start)}</span>
                <span>{fmtDate(progWindow.end)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h3>Planned Value</h3><span className="hint">Time-phased budget baseline for Earned Value — direct cost only, excludes overhead/margin/tax</span></div>
        <div className="card" style={{ padding: "18px 22px" }}>
          {!pvRows.length ? (
            <div className="empty">Set at least one category's planned start and end date above to see a time-phased Planned Value schedule.</div>
          ) : (
            <>
              <p className="hint" style={{ marginBottom: 14 }}>
                This is deliberately different from the Cash Flow section on the Summary/Dashboard tabs — Cash Flow
                spreads the whole Total Project Cost (including overhead, margin and tax) evenly, for a billing
                forecast. Planned Value spreads only the direct-cost budget, phased to when each category is actually
                scheduled, so it can be compared against real progress for Earned Value.
              </p>
              <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th></th>
                      <th className="num" style={{ width: 130 }}>Planned spend</th>
                      <th className="num" style={{ width: 130 }}>Cumulative (PV)</th>
                      <th className="num" style={{ width: 70 }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pvRows.map((row) => (
                      <tr key={row.label}>
                        <td className="label-cell">{row.label}</td>
                        <td style={{ minWidth: 120 }}>
                          <div style={{ background: "var(--surface-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${(row.amount / maxMonthly) * 100}%`,
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
            </>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Schedule history</h3>
          <span className="hint">{snapshots.length} import{snapshots.length === 1 ? "" : "s"} saved</span>
        </div>
        <div className="card" style={{ padding: "14px 22px" }}>
          {loadingSnapshots ? (
            <div className="hint">Loading…</div>
          ) : !snapshots.length ? (
            <div className="empty">No P6 imports yet — import a .xer file above to start building a history.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {snapshots.map((snap) => (
                <div key={snap.id} className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)", padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <b>{fmtDateTime(snap.imported_at)}</b>
                      <span className="hint" style={{ marginLeft: 8 }}>{snap.source_filename}</span>
                    </div>
                    <button className="btn btn-sm" onClick={() => toggleSnapshot(snap.id)}>
                      {expandedSnapshot === snap.id ? "Hide" : "Compare to current"}
                    </button>
                  </div>
                  {expandedSnapshot === snap.id && (
                    <div style={{ marginTop: 10, overflowX: "auto" }}>
                      {!snapshotCategories[snap.id] ? (
                        <div className="hint">Loading…</div>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th className="label-cell">Category</th>
                              <th style={{ width: 100 }}>Start (then)</th>
                              <th style={{ width: 100 }}>Start (now)</th>
                              <th style={{ width: 100 }}>End (then)</th>
                              <th style={{ width: 100 }}>End (now)</th>
                              <th className="num" style={{ width: 90 }}>End shift</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshotCategories[snap.id].map((row) => {
                              const current = row.category_id ? categories.find((c) => c.id === row.category_id) : undefined;
                              const shiftDays =
                                current?.planned_end && row.planned_end
                                  ? Math.round((new Date(current.planned_end).getTime() - new Date(row.planned_end).getTime()) / 86400000)
                                  : null;
                              return (
                                <tr key={row.id}>
                                  <td className="label-cell">
                                    {row.category_name}
                                    {!current && !row.category_id ? " (deleted since)" : ""}
                                  </td>
                                  <td className="mono" style={{ fontSize: 12 }}>{row.planned_start || "—"}</td>
                                  <td className="mono" style={{ fontSize: 12 }}>{current?.planned_start || "—"}</td>
                                  <td className="mono" style={{ fontSize: 12 }}>{row.planned_end || "—"}</td>
                                  <td className="mono" style={{ fontSize: 12 }}>{current?.planned_end || "—"}</td>
                                  <td className="num mono">
                                    {shiftDays === null ? "—" : shiftDays === 0 ? "On track" : shiftDays > 0 ? `+${shiftDays}d` : `${shiftDays}d`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <ProgrammeImportDialog
          project={project}
          categories={categories}
          setCategories={setCategories}
          onClose={() => setShowImport(false)}
          onImported={refreshSnapshots}
        />
      )}
    </div>
  );
}
