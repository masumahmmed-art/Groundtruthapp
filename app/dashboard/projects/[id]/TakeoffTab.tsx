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
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selected = drawings.find((d) => d.id === selectedId) || null;
  // Every page has its own scale; length and area use the current page's.
  const currentScale = selected ? pageScale(selected, page) : null;

  // --- upload -----------------------------------------------------------

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setNotice("Please choose a PDF drawing.");
      return;
    }
    setNotice(null);
    setUploading(true);
    try {
      const path = `${project.org_id}/${project.id}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage.from("drawings").upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase
        .from("drawings")
        .insert({ project_id: project.id, name: file.name, storage_path: path })
        .select("*")
        .single();
      if (error || !data) throw error || new Error("Could not save drawing");
      setDrawings((prev) => [...prev, data as DrawingRow]);
      setSelectedId((data as DrawingRow).id);
    } catch (err: any) {
      setNotice("Upload failed: " + (err?.message || String(err)));
    } finally {
      setUploading(false);
    }
  }

  async function deleteDrawing(d: DrawingRow) {
    setPending(null);
    await supabase.storage.from("drawings").remove([d.storage_path]);
    await supabase.from("drawings").delete().eq("id", d.id);
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

  const { numPages, loadingPdf, pageSize } = usePdfPage({ supabase, selected, page, canvasRef, overlayRef });

  // The scroll box only exists while a drawing is selected.
  useWheelZoom({ boxRef: scrollBoxRef, zoom, setZoom, active: selectedId });

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
  }, [measurements, points, tool, page]);

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
  // removes it, Enter finishes. Ignored while typing in a field or while an
  // input box is open. Re-subscribed each render so it sees current state.

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!tool || pending) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
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
    // Calibration uses exactly two points; fine-tune them, then Enter distance.
    if (tool === "calibrate" && points.length >= 2) return;
    const p = getCanvasPoint(overlayRef.current!, e);
    setPoints((prev) => [...prev, p]);
  }

  function undoPoint() {
    setPoints((prev) => prev.slice(0, -1));
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
            Upload a 2D drawing, calibrate its scale, then trace lengths / areas / counts and send them
            straight into the Bill of Quantities.
          </div>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleUpload} />
          <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "+ Upload drawing"}
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

      {drawings.length === 0 && <div className="empty">No drawings uploaded yet. Upload a PDF to get started.</div>}

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
                  "Fine-tune the ringed point with the arrow keys (Shift = bigger steps) or Backspace to redo it, then click Enter distance (or press Enter)."}
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

            {/* The box keeps the page's proportions (capped at 75vh) and reserves scrollbar space,
                so its size never changes while zooming and wheel zoom stays anchored under the cursor. */}
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
