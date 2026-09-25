import type { TakeoffKind, TakeoffPoint } from "@/lib/types";

export function drawShape(
  ctx: CanvasRenderingContext2D,
  pts: TakeoffPoint[],
  kind: TakeoffKind,
  color: string,
  close: boolean
) {
  if (kind === "count") {
    ctx.fillStyle = color;
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }
  if (!pts.length) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color + "33";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  if (close) ctx.closePath();
  if (kind === "area" && close) ctx.fill();
  ctx.stroke();
  pts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

// Converts a mouse event to native canvas pixels (see RENDER_SCALE).
export function getCanvasPoint(canvas: HTMLCanvasElement, e: React.MouseEvent<HTMLCanvasElement>): TakeoffPoint {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}
