"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow, LineItemRow, ProjectRow } from "@/lib/types";
import { parseSpreadsheetText, type ParseResult } from "@/lib/importParse";
import { IMPORT_CATEGORY_COLORS } from "@/lib/calc";
import { formatMoney } from "@/lib/units";

type CategoryTarget = "new" | string; // "new" or an existing category id

export default function ImportDialog({
  project,
  categories,
  setCategories,
  setItems,
  currency,
  onClose,
}: {
  project: ProjectRow;
  categories: CategoryRow[];
  setCategories: (updater: (c: CategoryRow[]) => CategoryRow[]) => void;
  setItems: (updater: (i: LineItemRow[]) => LineItemRow[]) => void;
  currency: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const [targets, setTargets] = useState<Record<number, CategoryTarget>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ items: number; categories: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set when an uploaded .xlsx/.xls workbook has more than one sheet — lets
  // the user pick which tab to import from (e.g. "App E") before it's
  // converted to rows and parsed the same way as a plain paste.
  const [workbookSheets, setWorkbookSheets] = useState<string[] | null>(null);
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);

  function handleParse() {
    setError(null);
    setDone(null);
    const result = parseSpreadsheetText(rawText);
    setParsed(result);
    const nextNames: Record<number, string> = {};
    const nextTargets: Record<number, CategoryTarget> = {};
    const nextChecked: Record<string, boolean> = {};
    result.categories.forEach((cat, ci) => {
      nextNames[ci] = cat.name;
      nextTargets[ci] = "new";
      cat.items.forEach((_, ii) => {
        nextChecked[`${ci}:${ii}`] = true;
      });
    });
    setNames(nextNames);
    setTargets(nextTargets);
    setChecked(nextChecked);
  }

  async function loadWorkbookSheet(file: File, sheetName: string) {
    setLoadingSheet(true);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[sheetName];
      if (!sheet) throw new Error(`Couldn't find a tab called "${sheetName}" in that file.`);
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      setRawText(csv);
    } catch (err: any) {
      setError(err?.message || "Couldn't read that spreadsheet file.");
    } finally {
      setLoadingSheet(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setWorkbookSheets(null);
    setWorkbookFile(null);

    const isExcel = /\.xlsx?$/i.test(file.name);
    if (isExcel) {
      setLoadingSheet(true);
      setError(null);
      try {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        if (wb.SheetNames.length === 1) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { blankrows: false });
          setRawText(csv);
        } else {
          // Multiple tabs — let the user pick one (e.g. "App E") rather
          // than guessing which one to import.
          setWorkbookSheets(wb.SheetNames);
          setWorkbookFile(file);
        }
      } catch (err: any) {
        setError(err?.message || "Couldn't read that spreadsheet file.");
      } finally {
        setLoadingSheet(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result || ""));
    reader.readAsText(file);
  }

  const selectedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);

  function toggleCategoryAll(ci: number, value: boolean) {
    if (!parsed) return;
    setChecked((prev) => {
      const next = { ...prev };
      parsed.categories[ci].items.forEach((_, ii) => {
        next[`${ci}:${ii}`] = value;
      });
      return next;
    });
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    try {
      let categoriesCreated = 0;
      let itemsCreated = 0;
      let colorIdx = categories.length;

      for (let ci = 0; ci < parsed.categories.length; ci++) {
        const cat = parsed.categories[ci];
        const rowsToImport = cat.items
          .map((item, ii) => ({ item, checked: !!checked[`${ci}:${ii}`] }))
          .filter((r) => r.checked);
        if (!rowsToImport.length) continue;

        const target = targets[ci] || "new";
        let categoryId = target;

        if (target === "new") {
          const name = (names[ci] || cat.name || "Imported items").trim() || "Imported items";
          const color = IMPORT_CATEGORY_COLORS[colorIdx % IMPORT_CATEGORY_COLORS.length];
          colorIdx++;
          const { data, error: catError } = await supabase
            .from("categories")
            .insert({ project_id: project.id, name, color, sort_order: categories.length + categoriesCreated + 1 })
            .select("*")
            .single();
          if (catError || !data) throw new Error(catError?.message || "Could not create category");
          categoryId = (data as CategoryRow).id;
          categoriesCreated++;
          setCategories((prev) => [...prev, data as CategoryRow]);
        }

        const rows = rowsToImport.map(({ item }, idx) => ({
          category_id: categoryId,
          description: item.description,
          unit: item.unit,
          qty: item.qty,
          labour: [],
          plant: [],
          material: [],
          subcontract: [],
          rate_mode: "flat" as const,
          flat_rate: item.rate,
          sort_order: idx + 1,
        }));

        const { data: inserted, error: itemError } = await supabase.from("line_items").insert(rows).select("*");
        if (itemError) throw new Error(itemError.message);
        itemsCreated += inserted?.length || 0;
        setItems((prev) => [...prev, ...((inserted || []) as LineItemRow[])]);
      }

      setDone({ items: itemsCreated, categories: categoriesCreated });
      setParsed(null);
      setRawText("");
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
      <div className="card" style={{ maxWidth: 780, width: "100%", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Import line items</h3>
            <div className="meta">Upload a spreadsheet, or paste rows copied from one.</div>
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
            Imported {done.items} line item{done.items === 1 ? "" : "s"}
            {done.categories > 0 ? ` into ${done.categories} new categor${done.categories === 1 ? "y" : "ies"}` : ""}.
            You can import more below, or close this dialog.
          </div>
        )}
        {error && <div className="auth-error" style={{ marginBottom: 14 }}>{error}</div>}

        {!parsed && (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              Upload an Excel (.xlsx) or .csv file, or paste rows copied from Excel or Google Sheets (select the
              range including the header row — Description / Unit / Quantity / Rate — and copy it with Ctrl/Cmd+C).
              Rows with a description but no quantity or rate are treated as section headings and become new
              categories — the priced items under each heading become that category's line items.
            </p>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <label className="btn btn-sm" style={{ cursor: "pointer" }}>
                {loadingSheet ? "Reading…" : "Upload .xlsx or .csv file"}
                <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFile} style={{ display: "none" }} disabled={loadingSheet} />
              </label>
              {workbookSheets && (
                <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
                  <label>Which tab?</label>
                  <select
                    key={workbookFile?.name}
                    defaultValue=""
                    onChange={(e) => {
                      if (workbookFile && e.target.value) loadWorkbookSheet(workbookFile, e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      Select a tab…
                    </option>
                    {workbookSheets.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>Or paste spreadsheet data directly</label>
              <textarea
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Item\tDescription\tUnit\tQuantity\tUnit Rate\n...\t...\t...\t...\t..."}
                style={{ fontFamily: "monospace", fontSize: 12.5 }}
              />
            </div>
            <button className="btn btn-primary" onClick={handleParse} disabled={!rawText.trim()}>
              Preview import
            </button>
          </>
        )}

        {parsed && (
          <div>
            {parsed.warnings.length > 0 && (
              <div className="note" style={{ marginBottom: 14 }}>
                <span>⚠</span>
                <span>{parsed.warnings.join(" ")}</span>
              </div>
            )}

            {parsed.categories.length === 0 && <div className="empty">Nothing recognisable was found in that paste.</div>}

            {parsed.categories.map((cat, ci) => {
              const allChecked = cat.items.every((_, ii) => checked[`${ci}:${ii}`]);
              return (
                <div key={ci} className="card rate-table-wrap" style={{ marginBottom: 16, padding: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                      <input type="checkbox" checked={allChecked} onChange={(e) => toggleCategoryAll(ci, e.target.checked)} />
                      Select all
                    </label>
                    <div className="field" style={{ flex: "1 1 220px", marginBottom: 0 }}>
                      <input
                        type="text"
                        value={names[ci] ?? cat.name}
                        onChange={(e) => setNames((prev) => ({ ...prev, [ci]: e.target.value }))}
                        style={{ fontWeight: 600 }}
                      />
                    </div>
                    <select
                      value={targets[ci] ?? "new"}
                      onChange={(e) => setTargets((prev) => ({ ...prev, [ci]: e.target.value }))}
                      style={{ maxWidth: 220 }}
                    >
                      <option value="new">Create as new category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          Add to: {c.name}
                        </option>
                      ))}
                    </select>
                    <span className="hint">
                      {cat.items.length} item{cat.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>Description</th>
                        <th style={{ width: 70 }}>Unit</th>
                        <th className="num" style={{ width: 90 }}>Qty</th>
                        <th className="num" style={{ width: 110 }}>Rate</th>
                        <th className="num" style={{ width: 110 }}>Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.items.map((item, ii) => (
                        <tr key={ii}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!checked[`${ci}:${ii}`]}
                              onChange={(e) => setChecked((prev) => ({ ...prev, [`${ci}:${ii}`]: e.target.checked }))}
                            />
                          </td>
                          <td>{item.description}</td>
                          <td>{item.unit}</td>
                          <td className="num mono">{item.qty}</td>
                          <td className="num mono">{formatMoney(item.rate, currency, 2)}</td>
                          <td className="num mono">{formatMoney(item.rate * item.qty, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {parsed.categories.length > 0 && (
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" onClick={handleImport} disabled={importing || selectedCount === 0}>
                  {importing ? "Importing…" : `Import ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}`}
                </button>
                <button className="btn" onClick={() => setParsed(null)} disabled={importing}>
                  Back
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
