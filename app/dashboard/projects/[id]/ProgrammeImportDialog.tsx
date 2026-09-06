"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow, ProjectRow, ProgrammeSnapshotRow } from "@/lib/types";
import { parseXer, type XerWbsNode } from "@/lib/xerParse";
import { IMPORT_CATEGORY_COLORS } from "@/lib/calc";

type MappingTarget = "skip" | "new" | string; // "skip", "new", or an existing category id

export default function ProgrammeImportDialog({
  project,
  categories,
  setCategories,
  onClose,
  onImported,
}: {
  project: ProjectRow;
  categories: CategoryRow[];
  setCategories: (updater: (c: CategoryRow[]) => CategoryRow[]) => void;
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = createClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState<{ nodes: XerWbsNode[]; warnings: string[] } | null>(null);
  const [targets, setTargets] = useState<Record<string, MappingTarget>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ mapped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true);
    setError(null);
    setDone(null);
    try {
      const text = await file.text();
      const result = parseXer(text);
      setParsed(result);
      setFileName(file.name);

      const nextTargets: Record<string, MappingTarget> = {};
      const nextNames: Record<string, string> = {};
      result.nodes.forEach((node) => {
        const match = categories.find((c) => c.name.trim().toLowerCase() === node.name.trim().toLowerCase());
        nextTargets[node.wbsId] = match ? match.id : "skip";
        nextNames[node.wbsId] = node.name;
      });
      setTargets(nextTargets);
      setNames(nextNames);
    } catch (err: any) {
      setError(err?.message || "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }

  const mappedCount = useMemo(
    () => (parsed ? parsed.nodes.filter((n) => (targets[n.wbsId] || "skip") !== "skip").length : 0),
    [parsed, targets]
  );

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    try {
      let workingCategories = [...categories];
      let colorIdx = categories.length;

      for (const node of parsed.nodes) {
        const target = targets[node.wbsId] || "skip";
        if (target === "skip") continue;

        if (target === "new") {
          const name = (names[node.wbsId] || node.name || "Imported from P6").trim() || "Imported from P6";
          const color = IMPORT_CATEGORY_COLORS[colorIdx % IMPORT_CATEGORY_COLORS.length];
          colorIdx++;
          const { data, error: catError } = await supabase
            .from("categories")
            .insert({
              project_id: project.id,
              name,
              color,
              sort_order: workingCategories.length + 1,
              planned_start: node.plannedStart,
              planned_end: node.plannedEnd,
            })
            .select("*")
            .single();
          if (catError || !data) throw new Error(catError?.message || "Could not create category");
          workingCategories.push(data as CategoryRow);
        } else {
          const { error: updError } = await supabase
            .from("categories")
            .update({ planned_start: node.plannedStart, planned_end: node.plannedEnd })
            .eq("id", target);
          if (updError) throw new Error(updError.message);
          workingCategories = workingCategories.map((c) =>
            c.id === target ? { ...c, planned_start: node.plannedStart, planned_end: node.plannedEnd } : c
          );
        }
      }

      // Save a full snapshot of every category's planned dates as they
      // stand right after this import, so it can be compared against a
      // later re-import.
      const { data: snapshot, error: snapError } = await supabase
        .from("programme_snapshots")
        .insert({ project_id: project.id, source_filename: fileName || "import.xer" })
        .select("*")
        .single();
      if (snapError || !snapshot) throw new Error(snapError?.message || "Could not save a programme snapshot");

      const snapshotRows = workingCategories.map((c) => ({
        snapshot_id: (snapshot as ProgrammeSnapshotRow).id,
        category_id: c.id,
        category_name: c.name,
        planned_start: c.planned_start || null,
        planned_end: c.planned_end || null,
      }));
      if (snapshotRows.length) {
        const { error: rowsError } = await supabase.from("programme_snapshot_categories").insert(snapshotRows);
        if (rowsError) throw new Error(rowsError.message);
      }

      setCategories(() => workingCategories);
      setDone({ mapped: mappedCount });
      onImported();
    } catch (err: any) {
      setError(err?.message || "Something went wrong during import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,20,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        zIndex: 100,
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" style={{ maxWidth: 860, width: "100%", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Import schedule from Primavera P6</h3>
            <div className="meta">Upload a .xer export — each WBS node maps to one of your categories.</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {done && (
          <div
            style={{
              margin: "14px 0",
              padding: "10px 13px",
              borderRadius: 8,
              background: "rgba(31,111,160,0.08)",
              border: "1px solid var(--blueprint)",
              color: "var(--blueprint)",
              fontSize: 14,
            }}
          >
            Applied dates to {done.mapped} categor{done.mapped === 1 ? "y" : "ies"} and saved this import as a
            programme snapshot. You can import another file, or close this dialog.
          </div>
        )}
        {error && <div className="auth-error" style={{ marginBottom: 14 }}>{error}</div>}

        {!parsed && (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              Export your schedule from Primavera P6 as a .xer file (File → Export → Primavera PM — XER) and upload
              it here. Each WBS node's activities are rolled up to a single planned start (earliest) and end (latest)
              date, ready to map onto your existing categories.
            </p>
            <label className="btn btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
              {reading ? "Reading…" : "Upload .xer file"}
              <input type="file" accept=".xer" onChange={handleFile} style={{ display: "none" }} disabled={reading} />
            </label>
          </>
        )}

        {parsed && (
          <div>
            {parsed.warnings.length > 0 && (
              <div className="note" style={{ marginTop: 10, marginBottom: 14 }}>
                <span>⚠</span>
                <span>{parsed.warnings.join(" ")}</span>
              </div>
            )}

            {parsed.nodes.length === 0 ? (
              <div className="empty">Nothing importable was found in that file.</div>
            ) : (
              <>
                <div className="card rate-table-wrap" style={{ boxShadow: "none", border: "1px solid var(--line)", maxHeight: 420, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th className="label-cell">WBS node (from P6)</th>
                        <th style={{ width: 100 }}>Start</th>
                        <th style={{ width: 100 }}>End</th>
                        <th className="num" style={{ width: 70 }}>Acts</th>
                        <th className="num" style={{ width: 80 }}>% cplt</th>
                        <th style={{ width: 240 }}>Map to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.nodes.map((node) => (
                        <tr key={node.wbsId}>
                          <td className="label-cell">{node.name}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{node.plannedStart || "—"}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{node.plannedEnd || "—"}</td>
                          <td className="num mono">{node.taskCount}</td>
                          <td className="num mono">{Math.round(node.avgPctComplete)}%</td>
                          <td>
                            <select
                              value={targets[node.wbsId] || "skip"}
                              onChange={(e) => setTargets((prev) => ({ ...prev, [node.wbsId]: e.target.value }))}
                              style={{ width: "100%" }}
                            >
                              <option value="skip">Skip</option>
                              <option value="new">Create new category</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  Set dates on: {c.name}
                                </option>
                              ))}
                            </select>
                            {targets[node.wbsId] === "new" && (
                              <input
                                type="text"
                                value={names[node.wbsId] ?? node.name}
                                onChange={(e) => setNames((prev) => ({ ...prev, [node.wbsId]: e.target.value }))}
                                style={{ width: "100%", marginTop: 4 }}
                                placeholder="New category name"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={handleImport} disabled={importing || mappedCount === 0}>
                    {importing ? "Importing…" : `Apply dates to ${mappedCount} categor${mappedCount === 1 ? "y" : "ies"}`}
                  </button>
                  <button className="btn" onClick={() => setParsed(null)} disabled={importing}>
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
