"use client";

import { useState } from "react";
import type { DrawingRow } from "@/lib/types";

// In-page replacements for window.prompt/confirm, which some embedded
// browsers don't support.
export type Pending =
  | { kind: "calibrate"; defaultUnit: string }
  | { kind: "label" }
  | { kind: "deleteDrawing"; drawing: DrawingRow }
  | { kind: "moveDrawing"; drawing: DrawingRow }
  | null;

const panelStyle: React.CSSProperties = {
  padding: 12,
  marginBottom: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "flex-end",
  borderColor: "var(--accent)",
};

export default function PendingInput({
  pending,
  onCalibrate,
  onLabel,
  onDeleteDrawing,
  onMoveDrawing,
  onCancel,
}: {
  pending: Exclude<Pending, null>;
  onCalibrate: (distance: number, unit: string) => void;
  onLabel: (label: string) => void;
  onDeleteDrawing: (d: DrawingRow) => void;
  onMoveDrawing: (d: DrawingRow) => void;
  onCancel: () => void;
}) {
  if (pending.kind === "calibrate") return <CalibrateForm defaultUnit={pending.defaultUnit} onSave={onCalibrate} onCancel={onCancel} />;
  if (pending.kind === "label") return <LabelForm onSave={onLabel} onCancel={onCancel} />;
  if (pending.kind === "moveDrawing") {
    return (
      <div className="card" style={panelStyle}>
        <div style={{ flexBasis: "100%", fontSize: 13 }}>
          <b>Move “{pending.drawing.name}” to this computer?</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>A copy of the PDF is <b>saved to your Downloads folder</b>, and this browser keeps its own copy.</li>
            <li>The online copy is then <b>deleted</b> to free up storage. This can't be undone.</li>
            <li>
              Your scales and measurements don't change. Anyone else using this drawing — including you on another
              computer — will need the PDF file itself, so keep the downloaded copy somewhere they can reach, such as your
              shared drive.
            </li>
          </ul>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => onMoveDrawing(pending.drawing)}>Download &amp; move</button>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    );
  }
  return (
    <div className="card" style={panelStyle}>
      <div style={{ flex: "1 1 240px", fontSize: 13 }}>
        Delete <b>{pending.drawing.name}</b> and all its measurements?
      </div>
      <button className="btn btn-sm btn-danger" autoFocus onClick={() => onDeleteDrawing(pending.drawing)}>Delete</button>
      <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function CalibrateForm({
  defaultUnit,
  onSave,
  onCancel,
}: {
  defaultUnit: string;
  onSave: (distance: number, unit: string) => void;
  onCancel: () => void;
}) {
  const [distance, setDistance] = useState("10");
  const [unit, setUnit] = useState(defaultUnit);
  const dist = parseFloat(distance);
  const valid = dist > 0;

  return (
    <form
      className="card"
      style={panelStyle}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(dist, unit.trim() || "m");
      }}
    >
      <div className="field" style={{ width: 150 }}>
        <label>Real-world distance</label>
        {/* No autoFocus: until the field is clicked, the arrow keys nudge the ringed point on the drawing. */}
        <input type="number" step="any" min="0" className="mono" value={distance} onChange={(e) => setDistance(e.target.value)} />
      </div>
      <div className="field" style={{ width: 90 }}>
        <label>Unit</label>
        <input type="text" placeholder="m" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-sm" disabled={!valid}>Set scale</button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
      <div style={{ flexBasis: "100%", fontSize: 12, color: "var(--ink-faint)" }}>
        How far apart are the two points you clicked, in real life? Need to fine-tune first? Use the arrow keys
        to nudge the ringed point (Shift = bigger steps), or Backspace to re-click it — then click into the
        distance field.
      </div>
    </form>
  );
}

function LabelForm({ onSave, onCancel }: { onSave: (label: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");

  return (
    <form
      className="card"
      style={panelStyle}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(label.trim());
      }}
    >
      <div className="field" style={{ flex: "1 1 220px" }}>
        <label>Label (optional)</label>
        <input type="text" autoFocus placeholder="e.g. Access road kerb" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-sm">Save measurement</button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
    </form>
  );
}
