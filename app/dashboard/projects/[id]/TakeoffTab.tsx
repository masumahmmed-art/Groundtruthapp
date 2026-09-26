"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CategoryRow,
  DrawingRow,
  LineItemRow,
  PageScale,
  ProjectRow,
  TakeoffMeasurementRow,
  TakeoffPoint,
} from "@/lib/types";
import { calibratedPages, measurementValue, pageScale, scaleFromCalibration } from "@/lib/takeoff";
import { numFmt } from "@/lib/calc";
import { COLORS, type Tool } from "./takeoff/constants";
import { drawShape, getCanvasPoint } from "./takeoff/drawShape";
import { usePdfPage } from "./takeoff/usePdfPage";
import { useWheelZoom } from "./takeoff/useWheelZoom";
import TakeoffToolbar from "./takeoff/TakeoffToolbar";
import MeasurementRow from "./takeoff/MeasurementRow";
import PendingInput, { type Pending } from "./takeoff/PendingInput";
import PageScalePrompt from "./takeoff/PageScalePrompt";
import { deleteLocalCopy, fingerprint, getLocalCopy, saveLocalCopy } from "@/lib/localDrawings";

function formatBytes(n: number | null | undefined): string {
  if (!n) return "";
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function TakeoffTab({
  project,
  categories,
  setItems,
  initialDrawings,
}: {
  project: ProjectRow;
  categories: CategoryRow[];
  setItems: (updater: (i: LineItemRow[]) => LineItemRow[]) => void;
  initialDrawings: DrawingRow[];
}) {
  const supabase = createClient();
  const [drawings, setDrawings] = useState<DrawingRow[]>(initialDrawings);
  const [selectedId, setSelectedId] = useState<string | null>(initialDrawings[0]?.id ?? null);
  const [measurements, setMeasurements] = useState<TakeoffMeasurementRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>(null);
  const [points, setPoints] = useState<TakeoffPoint[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFileInputRef = useRef<HTMLInputElement>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  // Drawing PDFs opened this session, by fingerprint — avoids re-reading the browser's saved copy.
  const sessionFiles = useRef(new Map<string, ArrayBuffer>());
  const [local, setLocal] = useState<{ hash: string; bytes: ArrayBuffer } | null>(null);
  const [lookingForFile, setLookingForFile] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selected = drawings.find((d) => d.id === selectedId) || null;
  // Every page has its own scale; length and area use the current page's.
  const currentScale = selected ? pageScale(selected, page) : null;
  // Drawings added since migration 004 are kept on users' PCs (no storage_path).
  // Only use the loaded file if it's this drawing's — never another drawing's
  // bytes left over from before a switch.
  const isLocalDrawing = !!selected && !selected.storage_path;
  const localBytes = isLocalDrawing && local && local.hash === selected.file_hash ? local.bytes : null;
  const needsFile = isLocalDrawing && !localBytes;

  // Keeps the file for this session and saves a copy in this browser. Saving
  // the copy is only a convenience — if the browser refuses, say so and carry on.
  async function keepFile(hash: string, bytes: ArrayBuffer) {
    sessionFiles.current.set(hash, bytes);
    setLocal({ hash, bytes });
    try {
      await saveLocalCopy(hash, bytes);
    } catch {
      setNotice("Couldn't keep a copy of this drawing in this browser (it may be out of space), so you'll need to open the file again next time.");
    }
  }

  // --- add a drawing (the PDF stays on this PC) ---------------------------

  async function handleAddDrawing(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isPdf(file)) {
      setNotice("Please choose a PDF drawing.");
      return;
    }
    setNotice(null);
    setUploading(true);
    try {
      const bytes = await file.arrayBuffer();
      const hash = await fingerprint(bytes);
      const existing = drawings.find((d) => d.file_hash === hash);
      if (existing) {
        await keepFile(hash, bytes);
        setSelectedId(existing.id);
        setNotice(`This drawing is already in this project, as “${existing.name}”.`);
        return;
      }
      const { data, error } = await supabase
        .from("drawings")
        .insert({ project_id: project.id, name: file.name, file_hash: hash, file_size: file.size, storage_path: null })
        .select("*")
        .single();
      if (error || !data) throw error || new Error("Could not save the drawing's details");
      await keepFile(hash, bytes);
      setDrawings((prev) => [...prev, data as DrawingRow]);
      setSelectedId((data as DrawingRow).id);
    } catch (err: any) {
      setNotice("Couldn't add the drawing: " + (err?.message || String(err)));
    } finally {
      setUploading(false);
    }
  }

  // --- open the file for a drawing kept on users' PCs ---------------------

  async function handleOpenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected?.file_hash) return;
    if (!isPdf(file)) {
      setNotice("Please choose a PDF drawing.");
      return;
    }
    const bytes = await file.arrayBuffer();
    const hash = await fingerprint(bytes);
    if (hash !== selected.file_hash) {
      setNotice(
        `“${file.name}” isn't the same file that “${selected.name}” was added from — its contents are different, so ` +
          "the measurements wouldn't line up. If it's a revised drawing, add it as a new drawing instead."
      );
      return;
    }
    setNotice(null);
    await keepFile(hash, bytes);
  }

  // Look for this PC's copy of the selected drawing: first this session's, then the browser's saved copy.
  useEffect(() => {
    if (!selected || selected.storage_path || !selected.file_hash) return;
    const hash = selected.file_hash;
    const inSession = sessionFiles.current.get(hash);
    if (inSession) {
      setLocal({ hash, bytes: inSession });
      return;
    }
    let cancelled = false;
    setLookingForFile(true);
    getLocalCopy(hash).then((bytes) => {
      if (cancelled) return;
      if (bytes) {
        sessionFiles.current.set(hash, bytes);
        setLocal({ hash, bytes });
      }
      setLookingForFile(false);
    });
    return () => {
      cancelled = true;
      setLookingForFile(false);
    };
  }, [selectedId, selected?.file_hash]);

  async function deleteDrawing(d: DrawingRow) {
    setPending(null);
    if (d.storage_path) await supabase.storage.from("drawings").remove([d.storage_path]);
    await supabase.from("drawings").delete().eq("id", d.id);
    // Drop this PC's copy too, unless another drawing in this project is the same file.
    if (d.file_hash && !drawings.some((x) => x.id !== d.id && x.file_hash === d.file_hash)) {
      sessionFiles.current.delete(d.file_hash);
      deleteLocalCopy(d.file_hash);
    }
    setDrawings((prev) => prev.filter((x) => x.id !== d.id));
    if (selectedId === d.id) setSelectedId(null);
  }

  // --- load selected drawing's measurements ------------------------------

  useEffect(() => {
    if (!selectedId) {
      setMeasurements([]);
      return;
    }
    setPage(1);
    setZoom(1);
    setTool(null);
    setPoints([]);
    setPending(null);
    supabase
      .from("takeoff_measurements")
      .select("*")
      .eq("drawing_id", selectedId)
      .order("sort_order")
      .then(({ data }) => setMeasurements((data || []) as TakeoffMeasurementRow[]));
  }, [selectedId]);

  // --- render the current page to canvas ---------------------------------
  // Must stay below the effect above so the reset runs first.

  const { numPages, loadingPdf, pageSize, renderCount } = usePdfPage({
    supabase,
    selected,
    localBytes,
    page,
    canvasRef,
    overlayRef,
  });

  // The scroll box only exists while a drawing is selected and its file is available.
  useWheelZoom({ boxRef: scrollBoxRef, zoom, setZoom, active: `${selectedId}:${needsFile}` });

  // --- draw overlay (in-progress + saved shapes for this page) -----------

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    measurements
      .filter((m) => m.page_number === page)
      .forEach((m) => drawShape(ctx, m.geometry, m.kind, m.line_item_id ? COLORS.linked : COLORS.saved, m.kind !== "length"));

    if (tool && points.length) {
      const color = tool === "calibrate" ? COLORS.calibrate : COLORS.inProgress;
      drawShape(ctx, points, tool === "calibrate" ? "length" : tool, color, false);
      // Ring the last point — it's the one the arrow keys nudge.
      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [measurements, points, tool, page, renderCount]); // renderCount: each page render resizes (and so clears) the overlay

  // --- full screen ---------------------------------------------------------

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === cardRef.current && !!cardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      cardRef.current?.requestFullscreen().catch(() => setNotice("Full screen isn't available in this browser."));
    }
  }

  // --- keyboard fine-tuning ------------------------------------------------
  // Arrow keys nudge the last point by one screen pixel (Shift: ten), Backspace
  // removes it, Enter finishes. Ignored while typing in a field. While the
  // scale's distance box is open the points can still be nudged; other input
  // boxes freeze them. Re-subscribed each render so it sees current state.

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!tool) return;
      if (pending && pending.kind !== "calibrate") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (pending && e.key === "Enter") return; // the distance box handles its own Enter
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (e.key in arrows) {
        const overlay = overlayRef.current;
        if (!overlay || !points.length) return;
        e.preventDefault(); // don't scroll the drawing
        const step = (overlay.width / overlay.getBoundingClientRect().width) * (e.shiftKey ? 10 : 1);
        const [dx, dy] = arrows[e.key];
        setPoints((prev) => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          const moved = {
            x: Math.min(overlay.width, Math.max(0, last.x + dx * step)),
            y: Math.min(overlay.height, Math.max(0, last.y + dy * step)),
          };
          return [...prev.slice(0, -1), moved];
        });
      } else if (e.key === "Backspace" && points.length) {
        e.preventDefault();
        undoPoint();
      } else if (e.key === "Enter") {
        e.preventDefault();
        finishMeasurement();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- click handling ------------------------------------------------------

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // While an input box is open the clicked points are frozen.
    if (!tool || pending) return;
    // Calibration uses exactly two points; the distance box opens on the second,
    // and the points can still be fine-tuned with the arrow keys while it's open.
    if (tool === "calibrate" && points.length >= 2) return;
    const p = getCanvasPoint(overlayRef.current!, e);
    setPoints((prev) => [...prev, p]);
    if (tool === "calibrate" && points.length === 1) {
      setPending({ kind: "calibrate", defaultUnit: currentScale?.unit || selected?.scale_unit || "m" });
    }
  }

  function undoPoint() {
    setPoints((prev) => prev.slice(0, -1));
    // With a point gone, calibration no longer has two points to measure between.
    if (pending?.kind === "calibrate") setPending(null);
  }

  function saveCalibration(dist: number, unit: string) {
    const [a, b] = points;
    setPending(null);
    setPoints([]);
    setTool(null);
    if (!a || !b) return;
    savePageScale({ px_per_unit: scaleFromCalibration(a, b, dist), unit });
  }

  // Stores `scale` for the current page. The legacy single-scale columns are
  // also updated so older deployments keep working; page_scales is only
  // written once migration 003 has added it.
  function savePageScale(scale: PageScale) {
    if (!selected) return;
    const update: Partial<DrawingRow> = { scale_px_per_unit: scale.px_per_unit, scale_unit: scale.unit, scale_page: page };
    if (selected.page_scales !== undefined) update.page_scales = { ...selected.page_scales, [String(page)]: scale };
    supabase
      .from("drawings")
      .update(update)
      .eq("id", selected.id)
      .select("*")
      .single()
      .then(({ data, error }) => {
        if (error) setNotice("Could not save the scale: " + error.message);
        if (data) setDrawings((prev) => prev.map((d) => (d.id === selected.id ? (data as DrawingRow) : d)));
      });
  }

  // Points belong to one page, so switching page abandons any measurement in progress.
  function changePage(updater: (p: number) => number) {
    setPage(updater);
    setPoints([]);
    setTool(null);
    setPending(null);
  }

  function selectTool(t: Exclude<Tool, null>) {
    setTool(t);
    setPoints([]);
    setPending(null);
    setNotice(null);
  }

  function finishMeasurement() {
    if (tool === "calibrate") {
      if (points.length === 2) setPending({ kind: "calibrate", defaultUnit: currentScale?.unit || selected?.scale_unit || "m" });
      return;
    }
    if (!tool || !selected || !points.length) return;
    if (tool === "length" && points.length < 2) return;
    if (tool === "area" && points.length < 3) return;
    // Counting doesn't depend on scale.
    if (tool !== "count" && !currentScale) {
      setNotice(`Page ${page} has no scale yet. Set or confirm this page's scale before measuring lengths or areas.`);
      return;
    }
    setPending({ kind: "label" });
  }

  async function saveMeasurement(label: string) {
    setPending(null);
    if (!tool || tool === "calibrate" || !selected) return;
    if (tool !== "count" && !currentScale) return;
    const value = measurementValue(tool, points, currentScale?.px_per_unit ?? 0);

    const { data, error } = await supabase
      .from("takeoff_measurements")
      .insert({
        drawing_id: selected.id,
        page_number: page,
        kind: tool,
        label,
        geometry: points,
        value,
        sort_order: measurements.length,
      })
      .select("*")
      .single();

    if (!error && data) setMeasurements((prev) => [...prev, data as TakeoffMeasurementRow]);
    setPoints([]);
    setTool(null);
  }

  function cancelMeasurement() {
    setPoints([]);
    setTool(null);
    setPending(null);
  }

  async function deleteMeasurement(m: TakeoffMeasurementRow) {
    await supabase.from("takeoff_measurements").delete().eq("id", m.id);
    setMeasurements((prev) => prev.filter((x) => x.id !== m.id));
  }

  // --- push a measurement's quantity into the BoQ as a new line item -----

  async function pushToEstimate(m: TakeoffMeasurementRow, categoryId: string, description: string, unit: string, qty: number) {
    const { data, error } = await supabase
      .from("line_items")
      // Same defaults as EstimateTab's "+ Add line item".
      .insert({
        category_id: categoryId,
        description,
        unit,
        qty,
        labour: [],
        plant: [],
        material: [],
        subcontract: [],
        rate_mode: "buildup",
        flat_rate: 0,
      })
      .select("*")
      .single();
    if (error || !data) {
      setNotice("Could not add to the estimate: " + (error?.message || ""));
      return;
    }
    setItems((prev) => [...prev, data as LineItemRow]);
    const { data: updated } = await supabase
      .from("takeoff_measurements")
      .update({ line_item_id: (data as LineItemRow).id })
      .eq("id", m.id)
      .select("*")
      .single();
    if (updated) setMeasurements((prev) => prev.map((x) => (x.id === m.id ? (updated as TakeoffMeasurementRow) : x)));
  }

  // --- render --------------------------------------------------------------

  const pageMeasurements = measurements.filter((m) => m.page_number === page);
  const otherPageScales = selected ? calibratedPages(selected).filter((o) => o.page !== page) : [];

  // Live quantity for the measurement being traced, using this page's scale.
  let runningTotal: string | null = null;
  if (tool === "count" && points.length) {
    runningTotal = `Count so far: ${points.length}`;
  } else if ((tool === "length" && points.length >= 2) || (tool === "area" && points.length >= 3)) {
    const name = tool === "length" ? "Length" : "Area";
    runningTotal = currentScale
      ? `${name} so far: ${numFmt.format(measurementValue(tool, points, currentScale.px_per_unit))} ${currentScale.unit}${tool === "area" ? "²" : ""}`
      : `${name} so far: — set this page's scale to see real units`;
  }

  return (
    <div>
      <div className="titleblock">
        <div>
          <h2 style={{ fontSize: 20 }}>Drawing Takeoff</h2>
          <div className="meta">
            Add a 2D drawing (PDF), calibrate its scale, then trace lengths / areas / counts and send them
            straight into the Bill of Quantities. Drawings stay on your computer — only their measurements
            and scales are saved online.
          </div>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={handleAddDrawing} />
          <input ref={openFileInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={handleOpenFile} />
          <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Adding…" : "+ Add drawing"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="note" role="alert" style={{ borderColor: "var(--danger)" }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{notice}</span>
          <button className="btn btn-ghost btn-sm" aria-label="Dismiss" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {drawings.length === 0 && <div className="empty">No drawings added yet. Click “+ Add drawing” and choose a PDF to get started.</div>}

      {drawings.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {drawings.map((d) => (
            <button
              key={d.id}
              className={"btn btn-sm" + (d.id === selectedId ? " active" : "")}
              onClick={() => setSelectedId(d.id)}
              style={d.id === selectedId ? { background: "var(--ink)", color: "#fff" } : {}}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div>
          {/* Full width, with the measurements list below. In full screen the card fills the
              screen and the drawing box stretches to fill whatever the toolbar leaves. */}
          <div
            ref={cardRef}
            className="card"
            style={
              isFullscreen
                ? { padding: 12, display: "flex", flexDirection: "column", height: "100vh", borderRadius: 0, background: "var(--surface)" }
                : { padding: 12 }
            }
          >
            <TakeoffToolbar
              page={page}
              numPages={numPages}
              setPage={changePage}
              zoom={zoom}
              setZoom={setZoom}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              tool={tool}
              pointCount={points.length}
              onSelectTool={selectTool}
              onUndo={undoPoint}
              onFinish={finishMeasurement}
              onCancel={cancelMeasurement}
              onDeleteDrawing={() => setPending({ kind: "deleteDrawing", drawing: selected })}
            />

            {/* Warnings normally show above the drawing list; in full screen that's off-screen. */}
            {isFullscreen && notice && (
              <div className="note" role="alert" style={{ borderColor: "var(--danger)", marginBottom: 10 }}>
                <span>⚠</span>
                <span style={{ flex: 1 }}>{notice}</span>
                <button className="btn btn-ghost btn-sm" aria-label="Dismiss" onClick={() => setNotice(null)}>✕</button>
              </div>
            )}

            {pending && (
              <PendingInput
                pending={pending}
                onCalibrate={saveCalibration}
                onLabel={saveMeasurement}
                onDeleteDrawing={deleteDrawing}
                // Just close the box: the points stay, so they can still be
                // fine-tuned (or the whole thing cancelled from the toolbar).
                onCancel={() => setPending(null)}
              />
            )}

            {!currentScale && !pending && tool !== "calibrate" && otherPageScales.length > 0 && (
              <PageScalePrompt
                key={`${selected.id}-${page}`}
                page={page}
                options={otherPageScales}
                onUse={savePageScale}
                onSetScale={() => selectTool("calibrate")}
              />
            )}

            <div className="note" style={{ marginBottom: 10 }}>
              <span>ℹ</span>
              <span>
                {currentScale
                  ? <>Page {page} scale set: calibrated in <b>{currentScale.unit}</b>.</>
                  : <>Page {page} has no scale yet — click <b>Set scale</b>, then click two points a known distance apart on the drawing. (Count doesn&apos;t need a scale.)</>}
                {" "}
                {!pending && tool === "calibrate" && points.length < 2 && `Click the two points now… (${points.length} of 2)`}
                {!pending && tool === "calibrate" && points.length === 2 &&
                  "Fine-tune the ringed point with the arrow keys (Shift = bigger steps) or Backspace to redo it, then click Enter distance."}
                {!pending && tool === "length" && "Click each point along the length, then Finish."}
                {!pending && tool === "area" && "Click each corner of the area, then Finish (auto-closes)."}
                {!pending && tool === "count" && "Click each item to count, then Finish."}
                {!pending && tool && tool !== "calibrate" && points.length > 0 &&
                  " Arrow keys nudge the ringed point (Shift = bigger steps); Backspace removes it; Enter finishes."}
                {runningTotal && (
                  <>
                    <br />
                    <b className="mono" aria-live="polite">{runningTotal}</b>
                  </>
                )}
              </span>
            </div>

            {needsFile ? (
              <div className="card" style={{ padding: "22px 24px", borderColor: "var(--accent)", textAlign: "center" }}>
                {lookingForFile ? (
                  <div style={{ color: "var(--ink-faint)" }}>Looking for this drawing on this computer…</div>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                      Open “{selected.name}”{selected.file_size ? ` (${formatBytes(selected.file_size)})` : ""} from this computer to view it
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14, maxWidth: 620, marginInline: "auto" }}>
                      Drawings are kept on each person's computer rather than online. Open the same PDF file this drawing
                      was added from — for example from your shared drive or email. The app checks it's exactly the same
                      file, then keeps a copy in this browser so it opens straight away next time.
                    </div>
                    <button className="btn btn-primary" onClick={() => openFileInputRef.current?.click()}>
                      Open file…
                    </button>
                  </>
                )}
              </div>
            ) : (
            /* The box keeps the page's proportions (capped at 75vh) and reserves scrollbar space,
               so its size never changes while zooming and wheel zoom stays anchored under the cursor. */
            <div
              ref={scrollBoxRef}
              style={{
                position: "relative",
                maxWidth: "100%",
                ...(isFullscreen
                  ? { flex: "1 1 auto", minHeight: 0 }
                  : { maxHeight: "75vh", aspectRatio: pageSize ? `${pageSize.width} / ${pageSize.height}` : undefined }),
                overflow: "auto",
                scrollbarGutter: "stable",
                border: "1px solid var(--line)",
              }}
            >
              {loadingPdf && <div style={{ padding: 20 }}>Loading page…</div>}
              {/* Both canvases share the same display width so the overlay stays aligned at any zoom. */}
              <canvas ref={canvasRef} style={{ display: "block", width: `${zoom * 100}%`, maxWidth: "none", height: "auto" }} />
              <canvas
                ref={overlayRef}
                onClick={handleCanvasClick}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${zoom * 100}%`,
                  maxWidth: "none",
                  height: "auto",
                  cursor: tool ? "crosshair" : "default",
                }}
              />
            </div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <h4 style={{ marginBottom: 8 }}>Measurements — page {page}</h4>
            {pageMeasurements.length === 0 && (
              <div className="empty">No measurements on this page yet.</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", columnGap: 12 }}>
              {pageMeasurements.map((m) => (
                <MeasurementRow
                  key={m.id}
                  m={m}
                  scaleUnit={pageScale(selected, m.page_number)?.unit ?? selected.scale_unit}
                  categories={categories}
                  onDelete={() => deleteMeasurement(m)}
                  onPush={(categoryId, description, unit, qty) => pushToEstimate(m, categoryId, description, unit, qty)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
