// Fixed render resolution for every page we draw to canvas. Geometry is
// always stored in these native canvas pixels, regardless of how large the
// canvas is displayed on screen (see getCanvasPoint) — so measurements stay
// accurate however the window is sized. Do not change this constant once
// drawings have been calibrated: existing calibrations are px-per-unit at
// this scale and would silently go wrong.
export const RENDER_SCALE = 2;

export type Tool = "calibrate" | "length" | "area" | "count" | null;

// Display zoom steps (1 = fit to width). Zoom only changes how large the
// canvas is shown; clicks are mapped back to native canvas pixels, so
// measurements are unaffected.
// Ctrl + mouse wheel zooms smoothly between the first and last level.
// Beyond 2 (RENDER_SCALE) the page is upscaled and looks softer, but clicks
// still map exactly to native canvas pixels, so high zoom only helps precision.
export const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6, 8];
export const MIN_ZOOM = ZOOM_LEVELS[0];
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

export const COLORS = {
  linked: "#16a34a", // saved measurement already pushed to the estimate
  saved: "#2563eb", // saved measurement not yet in the estimate
  calibrate: "#dc2626", // in-progress calibration line
  inProgress: "#f59e0b", // in-progress measurement
};
