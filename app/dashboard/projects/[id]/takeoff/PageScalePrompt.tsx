"use client";

import { useState } from "react";
import type { PageScale } from "@/lib/types";

// Shown on a page with no scale when other pages of the same drawing have
// one: lets the user confirm this page shares a scale, or calibrate it.
export default function PageScalePrompt({
  page,
  options,
  onUse,
  onSetScale,
}: {
  page: number;
  options: { page: number; scale: PageScale }[];
  onUse: (scale: PageScale) => void;
  onSetScale: () => void;
}) {
  // Default to the nearest calibrated page before this one, else the first.
  const nearest = [...options].reverse().find((o) => o.page < page) ?? options[0];
  const [fromPage, setFromPage] = useState(nearest.page);
  const chosen = options.find((o) => o.page === fromPage) ?? nearest;

  return (
    <div
      className="card"
      style={{ padding: 12, marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderColor: "var(--accent)" }}
    >
      <div style={{ flexBasis: "100%", fontSize: 13 }}>
        <b>Page {page} has no scale yet.</b> Is it drawn at the same scale as another page?
      </div>
      {options.length > 1 && (
        <select value={fromPage} onChange={(e) => setFromPage(Number(e.target.value))} aria-label="Copy scale from page">
          {options.map((o) => (
            <option key={o.page} value={o.page}>Page {o.page} ({o.scale.unit})</option>
          ))}
        </select>
      )}
      <button className="btn btn-sm" onClick={() => onUse(chosen.scale)}>
        Use page {chosen.page}&apos;s scale
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onSetScale}>Set scale for this page</button>
    </div>
  );
}
