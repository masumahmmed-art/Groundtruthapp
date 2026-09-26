"use client";

import { ZOOM_LEVELS, type Tool } from "./constants";

const TOOL_BUTTONS: { tool: Exclude<Tool, null>; label: string }[] = [
  { tool: "calibrate", label: "Set scale" },
  { tool: "length", label: "+ Length" },
  { tool: "area", label: "+ Area" },
  { tool: "count", label: "+ Count" },
];

export default function TakeoffToolbar({
  page,
  numPages,
  setPage,
  zoom,
  setZoom,
  isFullscreen,
  onToggleFullscreen,
  tool,
  pointCount,
  onSelectTool,
  onUndo,
  onFinish,
  onCancel,
  onDeleteDrawing,
}: {
  page: number;
  numPages: number;
  setPage: (updater: (p: number) => number) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  tool: Tool;
  pointCount: number;
  onSelectTool: (tool: Exclude<Tool, null>) => void;
  onUndo: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onDeleteDrawing: () => void;
}) {
  // Wheel zoom can leave zoom between levels, so step to the nearest level either side.
  const prevZoom = [...ZOOM_LEVELS].reverse().find((z) => z < zoom - 0.001);
  const nextZoom = ZOOM_LEVELS.find((z) => z > zoom + 0.001);
  // Calibration takes exactly two points; the distance is entered after fine-tuning them.
  const finishLabel = tool === "calibrate" ? "Enter distance" : "Finish";
  const finishReady = tool === "calibrate" ? pointCount === 2 : pointCount > 0;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Page</button>
      <span className="mono" style={{ fontSize: 12.5 }}>
        Page {page} / {numPages}
      </span>
      <button className="btn btn-sm" disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}>Page →</button>
      <span style={{ width: 1, height: 20, background: "var(--line)", margin: "0 4px" }} />
      <button className="btn btn-sm" title="Zoom out (or Ctrl + scroll)" disabled={prevZoom === undefined} onClick={() => prevZoom !== undefined && setZoom(prevZoom)}>−</button>
      <button className="btn btn-sm mono" title="Fit to width" style={{ minWidth: 56 }} onClick={() => setZoom(1)}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="btn btn-sm" title="Zoom in (or Ctrl + scroll)" disabled={nextZoom === undefined} onClick={() => nextZoom !== undefined && setZoom(nextZoom)}>+</button>
      <button className="btn btn-sm" title={isFullscreen ? "Exit full screen (Esc)" : "Fill the whole screen with the drawing"} onClick={onToggleFullscreen}>
        {isFullscreen ? "Exit full screen" : "⛶ Full screen"}
      </button>
      <span style={{ width: 1, height: 20, background: "var(--line)", margin: "0 4px" }} />
      {TOOL_BUTTONS.map((b) => (
        <button
          key={b.tool}
          className="btn btn-sm"
          style={tool === b.tool ? { background: "var(--ink)", color: "#fff" } : {}}
          onClick={() => onSelectTool(b.tool)}
        >
          {b.label}
        </button>
      ))}
      {tool && (
        <>
          <button className="btn btn-sm" title="Remove the last point (Backspace)" disabled={pointCount === 0} onClick={onUndo}>
            ↶ Undo point
          </button>
          <button className="btn btn-sm" title="Or press Enter" disabled={!finishReady} onClick={onFinish}>{finishLabel}</button>
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
        </>
      )}
      <button className="btn btn-sm btn-ghost btn-danger" style={{ marginLeft: "auto" }} onClick={onDeleteDrawing}>
        Delete drawing
      </button>
    </div>
  );
}
