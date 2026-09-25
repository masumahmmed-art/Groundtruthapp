"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { MAX_ZOOM, MIN_ZOOM } from "./constants";

// Ctrl + mouse wheel (and trackpad pinch, which browsers report as
// ctrl+wheel) over `boxRef` zooms around the cursor, keeping the point
// under the pointer fixed. `active` should change whenever the box mounts.
export function useWheelZoom({
  boxRef,
  zoom,
  setZoom,
  active,
}: {
  boxRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  setZoom: (zoom: number) => void;
  active: unknown;
}) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const anchor = useRef<{ x: number; y: number; ratio: number } | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      // Must be a non-passive listener, or the browser zooms the whole page.
      e.preventDefault();
      const z = zoomRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * Math.exp(-e.deltaY * 0.0015)));
      if (next === z) return;
      const rect = box!.getBoundingClientRect();
      anchor.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, ratio: next / z };
      setZoom(next);
    }
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [active]);

  // After the canvases resize, scroll so the cursor's point stays put.
  useLayoutEffect(() => {
    const a = anchor.current;
    const box = boxRef.current;
    if (!a || !box) return;
    anchor.current = null;
    box.scrollLeft = (box.scrollLeft + a.x) * a.ratio - a.x;
    box.scrollTop = (box.scrollTop + a.y) * a.ratio - a.y;
  }, [zoom]);
}
