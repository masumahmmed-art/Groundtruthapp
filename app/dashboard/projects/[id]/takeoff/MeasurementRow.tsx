"use client";

import { useState } from "react";
import type { CategoryRow, TakeoffMeasurementRow } from "@/lib/types";
import { unitLabel } from "@/lib/takeoff";
import { numFmt } from "@/lib/calc";

export default function MeasurementRow({
  m,
  scaleUnit,
  categories,
  onDelete,
  onPush,
}: {
  m: TakeoffMeasurementRow;
  scaleUnit: string;
  categories: CategoryRow[];
  onDelete: () => void;
  onPush: (categoryId: string, description: string, unit: string, qty: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [description, setDescription] = useState(m.label || `${m.kind} from drawing`);
  const unit = unitLabel(m.kind, scaleUnit);
  const [qty, setQty] = useState(Math.round(m.value * 100) / 100);

  return (
    <div className="card" style={{ padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.label || `Untitled ${m.kind}`}</div>
          <div className="mono" style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
            {numFmt.format(m.value)} {unit}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {m.line_item_id ? (
            <span style={{ fontSize: 12, color: "#16a34a" }}>✓ In estimate</span>
          ) : (
            <button className="btn btn-sm" onClick={() => setOpen((o) => !o)}>→ Send to estimate</button>
          )}
          <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete}>✕</button>
        </div>
      </div>
      {open && !m.line_item_id && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "2 1 200px" }}>
            <label>Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field" style={{ width: 90 }}>
            <label>Qty</label>
            <input type="number" step="any" className="mono" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} />
          </div>
          <button
            className="btn btn-sm"
            disabled={!categoryId}
            onClick={() => { onPush(categoryId, description, unit, qty); setOpen(false); }}
          >
            Add line item
          </button>
        </div>
      )}
    </div>
  );
}
