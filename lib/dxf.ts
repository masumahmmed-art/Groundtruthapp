// DXF drawings for takeoff.
//
// A DXF is read into a flat list of polylines and texts in drawing
// coordinates, then drawn onto the same takeoff canvas a PDF page is. From
// there on nothing knows the difference: measurements are stored in canvas
// pixels and converted with the page's scale, exactly as for PDFs.
//
// The drawing is fitted to a fixed canvas size (DXF_MAX_SIDE), so the same
// file always lands on the same pixels. Do not change DXF_MAX_SIDE, DXF_MARGIN
// or how extents are worked out once people have measured DXF drawings:
// their saved points and scales would silently no longer line up.

import DxfParser from "dxf-parser";

export const DXF_MAX_SIDE = 4800; // px on the longer side; about an A1 PDF page at RENDER_SCALE 2
export const DXF_MARGIN = 48; // px of white border around the drawing

type Pt = { x: number; y: number };

export type DxfPrimitive =
  | { kind: "poly"; pts: Pt[]; closed: boolean }
  | {
      kind: "text";
      at: Pt;
      height: number;
      rotation: number;
      text: string;
      align: "left" | "center" | "right";
      /** How far below `at` the first line's baseline sits, as a fraction of the text height. */
      drop: number;
    };

export interface DxfDrawing {
  primitives: DxfPrimitive[];
  /** $INSUNITS header value (0 or undefined = not set in the file). */
  insunits: number | undefined;
  /** Model-space extents of everything drawn, in drawing units. */
  extents: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

export interface DxfLayout {
  /** Canvas px per drawing unit. */
  k: number;
  width: number;
  height: number;
  minX: number;
  maxY: number;
}

/** How many metres one drawing unit is, from the DXF's $INSUNITS; null when the file doesn't say. */
export function dxfUnitInMetres(insunits: number | undefined): number | null {
  switch (insunits) {
    case 1: return 0.0254; // inches
    case 2: return 0.3048; // feet
    case 4: return 0.001; // millimetres
    case 5: return 0.01; // centimetres
    case 6: return 1; // metres
    case 7: return 1000; // kilometres
    case 14: return 0.1; // decimetres
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export class DxfError extends Error {
  name = "DxfError";
}

export function parseDxf(bytes: ArrayBuffer): DxfDrawing {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 22));
  if (head.startsWith("AutoCAD Binary DXF")) {
    throw new DxfError("This is a binary DXF. Please save it from your CAD program as an ASCII DXF and open that instead.");
  }
  // Older DXFs are ANSI rather than UTF-8; decode leniently — only text labels could be affected, never geometry.
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(bytes);

  let doc: any;
  try {
    doc = new DxfParser().parseSync(text);
  } catch (err: any) {
    throw new DxfError("Couldn't read this DXF file: " + (err?.message || String(err)));
  }
  if (!doc) throw new DxfError("Couldn't read this DXF file.");

  const layers: Record<string, any> = doc.tables?.layer?.layers ?? {};
  const hidden = (layer: string | undefined) => {
    const l = layer ? layers[layer] : undefined;
    return !!l && (l.frozen || l.visible === false);
  };

  const primitives: DxfPrimitive[] = [];
  const identity: Xform = (p) => p;

  function addEntity(e: any, xf: Xform, parentLayer: string | undefined, depth: number) {
    // Inside a block, entities on layer "0" take the layer of the insert.
    const layer = e.layer === "0" && parentLayer ? parentLayer : e.layer;
    if (hidden(layer) || e.inPaperSpace || e.visible === false) return;

    const ez = e.extrusionDirection?.z ?? e.extrusionDirectionZ ?? 1;
    const ocs: Xform = ez < 0 ? (p) => xf({ x: -p.x, y: p.y }) : xf; // mirrored in plan

    const poly = (pts: Pt[], closed: boolean) => {
      if (pts.length >= 2) primitives.push({ kind: "poly", pts: pts.map(ocs), closed });
    };

    switch (e.type) {
      case "LINE":
        if (e.vertices?.length >= 2) poly([e.vertices[0], e.vertices[1]], false);
        break;
      case "LWPOLYLINE":
      case "POLYLINE": {
        const vs = (e.vertices || []).filter((v: any) => !v.splineFrameControlPoint);
        const closed = !!e.shape;
        const pts: Pt[] = [];
        for (let i = 0; i < vs.length; i++) {
          const a = vs[i];
          const b = vs[(i + 1) % vs.length];
          pts.push({ x: a.x, y: a.y });
          if (a.bulge && (i < vs.length - 1 || closed)) pts.push(...bulgePoints(a, b, a.bulge));
        }
        poly(pts, closed);
        break;
      }
      case "CIRCLE":
        poly(arcPoints(e.center, e.radius, 0, Math.PI * 2), true);
        break;
      case "ARC": {
        let end = e.endAngle;
        if (end <= e.startAngle) end += Math.PI * 2;
        poly(arcPoints(e.center, e.radius, e.startAngle, end), false);
        break;
      }
      case "ELLIPSE":
        poly(ellipsePoints(e), false);
        break;
      case "SPLINE":
        poly(splinePoints(e), !!(e.closed));
        break;
      case "SOLID":
      case "3DFACE":
        if (e.points?.length >= 3) poly(e.type === "SOLID" && e.points.length === 4 ? [e.points[0], e.points[1], e.points[3], e.points[2]] : e.points, true);
        break;
      case "TEXT":
      case "MTEXT": {
        const isM = e.type === "MTEXT";
        let at: Pt | undefined = isM ? e.position : e.startPoint;
        const height = isM ? e.height : e.textHeight;
        const str = isM ? cleanMText(e.text) : e.text;
        let align: "left" | "center" | "right" = "left";
        let drop = 0;
        if (isM) {
          // attachmentPoint 1–9: top/middle/bottom rows of left/centre/right.
          const ap = e.attachmentPoint || 1;
          align = (["left", "center", "right"] as const)[(ap - 1) % 3];
          drop = ap <= 3 ? 1 : ap <= 6 ? 0.5 : 0;
        } else if ((e.halign || e.valign) && e.endPoint) {
          at = e.endPoint;
          align = e.halign === 2 ? "right" : e.halign === 1 || e.halign === 4 ? "center" : "left";
          drop = e.valign === 3 ? 1 : e.valign === 2 || e.halign === 4 ? 0.5 : 0;
        }
        if (at && height > 0 && str) {
          const rot = rad(e.rotation || 0);
          const p0 = ocs(at);
          // Carry rotation and size through any insert's transform.
          const p1 = ocs({ x: at.x + Math.cos(rot), y: at.y + Math.sin(rot) });
          const p2 = ocs({ x: at.x - Math.sin(rot) * height, y: at.y + Math.cos(rot) * height });
          const rotation = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          primitives.push({ kind: "text", at: p0, height: Math.hypot(p2.x - p0.x, p2.y - p0.y), rotation, text: str, align, drop });
        }
        break;
      }
      case "INSERT":
      case "DIMENSION": {
        if (depth > 8) break; // guards against a block that contains itself
        const blockName = e.type === "INSERT" ? e.name : e.block;
        const block = blockName ? doc.blocks?.[blockName] : undefined;
        if (!block?.entities) break;
        const base: Pt = block.position || { x: 0, y: 0 };
        // Dimension blocks are already drawn in world coordinates.
        const inner: Xform =
          e.type === "DIMENSION"
            ? ocs
            : insertXform(e, base, ocs);
        for (const child of block.entities) addEntity(child, inner, layer, depth + 1);
        break;
      }
      default:
        // HATCH, IMAGE, POINT, etc. are not drawn — they rarely help with takeoff.
        break;
    }
  }

  for (const e of doc.entities || []) addEntity(e, identity, undefined, 0);

  return { primitives, insunits: doc.header?.$INSUNITS, extents: extentsOf(primitives) };
}

type Xform = (p: Pt) => Pt;

function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

function insertXform(e: any, base: Pt, outer: Xform): Xform {
  const sx = e.xScale ?? 1;
  const sy = e.yScale ?? 1;
  const r = rad(e.rotation || 0);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const pos: Pt = e.position || { x: 0, y: 0 };
  return (p) => {
    const x = (p.x - base.x) * sx;
    const y = (p.y - base.y) * sy;
    return outer({ x: pos.x + x * cos - y * sin, y: pos.y + x * sin + y * cos });
  };
}

function arcPoints(c: Pt, r: number, start: number, end: number): Pt[] {
  const steps = Math.max(8, Math.ceil(Math.abs(end - start) / (Math.PI / 36))); // every 5°
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

/** Points strictly between a and b along a polyline bulge (bulge = tan(sweep / 4)). */
function bulgePoints(a: Pt, b: Pt, bulge: number): Pt[] {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (!chord) return [];
  const sweep = 4 * Math.atan(bulge);
  const r = chord / (2 * Math.sin(sweep / 2));
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const d = r * Math.cos(sweep / 2); // centre's distance from the chord midpoint (signed)
  const ux = (b.x - a.x) / chord;
  const uy = (b.y - a.y) / chord;
  const c = { x: mid.x - uy * d, y: mid.y + ux * d };
  const start = Math.atan2(a.y - c.y, a.x - c.x);
  const pts = arcPoints(c, Math.abs(r), start, start + sweep);
  return pts.slice(1, -1);
}

function ellipsePoints(e: any): Pt[] {
  const c = e.center;
  const ma = e.majorAxisEndPoint;
  const a = Math.hypot(ma.x, ma.y);
  const b = a * (e.axisRatio ?? 1);
  const rot = Math.atan2(ma.y, ma.x);
  let t0 = e.startAngle ?? 0;
  let t1 = e.endAngle ?? Math.PI * 2;
  if (t1 <= t0) t1 += Math.PI * 2;
  const steps = Math.max(16, Math.ceil((t1 - t0) / (Math.PI / 36)));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const x = a * Math.cos(t);
    const y = b * Math.sin(t);
    pts.push({ x: c.x + x * Math.cos(rot) - y * Math.sin(rot), y: c.y + x * Math.sin(rot) + y * Math.cos(rot) });
  }
  return pts;
}

function splinePoints(e: any): Pt[] {
  const cps: Pt[] = e.controlPoints || [];
  const knots: number[] = e.knotValues || [];
  const p: number = e.degreeOfSplineCurve || 3;
  if (cps.length > p && knots.length === cps.length + p + 1) {
    // de Boor evaluation of the (non-rational) B-spline.
    const lo = knots[p];
    const hi = knots[knots.length - p - 1];
    const steps = Math.max(16, cps.length * 8);
    const pts: Pt[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = lo + ((hi - lo) * s) / steps;
      let k = p;
      while (k < cps.length - 1 && t >= knots[k + 1]) k++;
      const d = cps.slice(k - p, k + 1).map((q) => ({ x: q.x, y: q.y }));
      for (let r = 1; r <= p; r++) {
        for (let j = p; j >= r; j--) {
          const i = k - p + j;
          const denom = knots[i + p - r + 1] - knots[i];
          const alpha = denom ? (t - knots[i]) / denom : 0;
          d[j] = { x: (1 - alpha) * d[j - 1].x + alpha * d[j].x, y: (1 - alpha) * d[j - 1].y + alpha * d[j].y };
        }
      }
      pts.push(d[p]);
    }
    return pts;
  }
  const fit: Pt[] = e.fitPoints || [];
  if (fit.length >= 2) return catmullRom(fit);
  return cps;
}

function catmullRom(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < 8; s++) {
      const t = s / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** MTEXT with its inline formatting codes removed; paragraph breaks become new lines. */
function cleanMText(s: string): string {
  return (s || "")
    .replace(/\\P/g, "\n")
    .replace(/\\[ACcFfHhQqTtWw][^;]*;/g, "")
    .replace(/\\[LlOoKk]/g, "")
    .replace(/\\S([^;^/#]*)[\^/#]([^;]*);/g, "$1/$2")
    .replace(/\\~/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\\\\/g, "\\");
}

function extentsOf(prims: DxfPrimitive[]): DxfDrawing["extents"] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (p: Pt) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const pr of prims) {
    if (pr.kind === "poly") pr.pts.forEach(add);
    else {
      // Approximate text box (0.6 × height per character), turned with the text.
      const lines = pr.text.split("\n");
      const w = 0.6 * pr.height * Math.max(...lines.map((l) => l.length));
      const x0 = pr.align === "left" ? 0 : pr.align === "center" ? -w / 2 : -w;
      const top = pr.height * (1 - pr.drop);
      const bottom = -pr.height * (pr.drop + (lines.length - 1) * 1.4) - 0.25 * pr.height;
      const cos = Math.cos(pr.rotation);
      const sin = Math.sin(pr.rotation);
      for (const [u, v] of [[x0, top], [x0 + w, top], [x0, bottom], [x0 + w, bottom]]) {
        add({ x: pr.at.x + u * cos - v * sin, y: pr.at.y + u * sin + v * cos });
      }
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Layout and drawing
// ---------------------------------------------------------------------------

export function layoutDxf(d: DxfDrawing): DxfLayout | null {
  if (!d.extents) return null;
  const { minX, minY, maxX, maxY } = d.extents;
  const w = Math.max(maxX - minX, 1e-9);
  const h = Math.max(maxY - minY, 1e-9);
  const inner = DXF_MAX_SIDE - 2 * DXF_MARGIN;
  const k = inner / Math.max(w, h);
  return {
    k,
    width: Math.max(1, Math.round(w * k + 2 * DXF_MARGIN)),
    height: Math.max(1, Math.round(h * k + 2 * DXF_MARGIN)),
    minX,
    maxY,
  };
}

/**
 * The page scale a DXF can be given without the user calibrating it: canvas px
 * per metre, from the file's own units. Null when the file doesn't state units.
 */
export function dxfAutoScale(d: DxfDrawing, layout: DxfLayout): { px_per_unit: number; unit: string } | null {
  const m = dxfUnitInMetres(d.insunits);
  if (!m) return null;
  return { px_per_unit: layout.k / m, unit: "m" };
}

export function renderDxf(ctx: CanvasRenderingContext2D, d: DxfDrawing, L: DxfLayout) {
  const X = (x: number) => (x - L.minX) * L.k + DXF_MARGIN;
  const Y = (y: number) => (L.maxY - y) * L.k + DXF_MARGIN;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, L.width, L.height);
  // One dark colour for everything: CAD colours are chosen for a black
  // background and yellow or white lines would vanish on white.
  ctx.strokeStyle = "#1f2328";
  ctx.fillStyle = "#1f2328";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  for (const p of d.primitives) {
    if (p.kind !== "poly") continue;
    ctx.moveTo(X(p.pts[0].x), Y(p.pts[0].y));
    for (let i = 1; i < p.pts.length; i++) ctx.lineTo(X(p.pts[i].x), Y(p.pts[i].y));
    if (p.closed) ctx.closePath();
  }
  ctx.stroke();

  for (const p of d.primitives) {
    if (p.kind !== "text") continue;
    const size = p.height * L.k;
    if (size < 3) continue; // too small to read at this scale
    ctx.save();
    ctx.translate(X(p.at.x), Y(p.at.y));
    ctx.rotate(-p.rotation);
    ctx.font = `${size}px Arial, sans-serif`;
    ctx.textAlign = p.align;
    p.text.split("\n").forEach((line, i) => ctx.fillText(line, 0, (p.drop + i * 1.4) * size));
    ctx.restore();
  }
}
