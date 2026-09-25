import type { DrawingRow, PageScale, TakeoffPoint } from "@/lib/types";

/** Straight-line (Euclidean) distance between two points, in PDF page-point units. */
function dist(a: TakeoffPoint, b: TakeoffPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Total length of an open polyline, in page-point units. */
export function polylinePxLength(points: TakeoffPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** Area of a closed polygon via the shoelace formula, in page-point^2 units. Points need not be pre-closed. */
export function polygonPxArea(points: TakeoffPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Converts a raw px measurement (length or area, in PDF page-point units) into
 * a real-world quantity using the drawing's calibrated scale.
 *
 * scalePxPerUnit = how many page-points correspond to one real-world unit
 * (e.g. one metre), as established by clicking two points of known distance.
 */
export function toRealLength(pxLength: number, scalePxPerUnit: number): number {
  if (!scalePxPerUnit) return 0;
  return pxLength / scalePxPerUnit;
}

export function toRealArea(pxArea: number, scalePxPerUnit: number): number {
  if (!scalePxPerUnit) return 0;
  return pxArea / (scalePxPerUnit * scalePxPerUnit);
}

/** scale_px_per_unit given two calibration points and the real-world distance the user typed in. */
export function scaleFromCalibration(p1: TakeoffPoint, p2: TakeoffPoint, realDistance: number): number {
  const px = dist(p1, p2);
  if (!realDistance || realDistance <= 0) return 0;
  return px / realDistance;
}

/**
 * Computes the real-world quantity for a finished measurement, in the
 * drawing's scale_unit (length/count) or scale_unit^2 (area).
 */
export function measurementValue(
  kind: "length" | "area" | "count",
  points: TakeoffPoint[],
  scalePxPerUnit: number
): number {
  if (kind === "count") return points.length;
  if (kind === "length") return toRealLength(polylinePxLength(points), scalePxPerUnit);
  return toRealArea(polygonPxArea(points), scalePxPerUnit);
}

/**
 * The calibrated scale for one page of a drawing, or null if that page hasn't
 * been calibrated. If migration 003 hasn't been run (no page_scales column),
 * falls back to the legacy single scale for every page, as before.
 */
export function pageScale(d: DrawingRow, page: number): PageScale | null {
  if (d.page_scales === undefined) {
    return d.scale_px_per_unit ? { px_per_unit: d.scale_px_per_unit, unit: d.scale_unit } : null;
  }
  const s = d.page_scales[String(page)];
  return s && s.px_per_unit > 0 ? s : null;
}

/** Pages of a drawing that have their own scale, in page order. */
export function calibratedPages(d: DrawingRow): { page: number; scale: PageScale }[] {
  return Object.entries(d.page_scales ?? {})
    .filter(([, s]) => s && s.px_per_unit > 0)
    .map(([p, s]) => ({ page: Number(p), scale: s }))
    .sort((a, b) => a.page - b.page);
}

export function unitLabel(kind: "length" | "area" | "count", scaleUnit: string): string {
  if (kind === "count") return "each";
  if (kind === "area") return `${scaleUnit}²`;
  return scaleUnit;
}
