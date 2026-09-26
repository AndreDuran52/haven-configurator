// Tight orthographic fit (plan §7.2 "Fit rule"): project the silhouette points
// onto the preset's screen basis and pick the zoom (CSS px per inch) that fills
// the view minus padding. Unlike camera-controls' fitToBox it keeps the angle,
// pads in pixels and fits the real points instead of a box.
import type { PresetDef } from './presets';
import { add, dot, presetDirection, screenBasis, type Vec3 } from './screenBasis';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface OrthoFit {
  target: Vec3;
  zoom: number;
  /** projected extents in inches along screen right / up */
  spanU: number;
  spanV: number;
}

/** Padding: 6 % of the short side, clamped to 20–64 CSS px. */
export function defaultPadding(viewW: number, viewH: number): Insets {
  const p = Math.round(Math.min(64, Math.max(20, 0.06 * Math.min(viewW, viewH))));
  return { top: p, right: p, bottom: p, left: p };
}

export function fitOrtho(points: readonly Vec3[], preset: PresetDef, viewW: number, viewH: number, pad: Insets): OrthoFit {
  const { right, up, back } = screenBasis(presetDirection(preset), preset.azimuthDeg);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  let w0 = Infinity;
  let w1 = -Infinity;
  for (const p of points) {
    const u = dot(p, right);
    const v = dot(p, up);
    const w = dot(p, back);
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
    w0 = Math.min(w0, w);
    w1 = Math.max(w1, w);
  }
  const spanU = Math.max(u1 - u0, 1e-3);
  const spanV = Math.max(v1 - v0, 1e-3);
  const zoom = Math.min(Math.max(viewW - pad.left - pad.right, 1) / spanU, Math.max(viewH - pad.top - pad.bottom, 1) / spanV);
  // centre of the padded area, as a shift of the target in inches
  const uc = (u0 + u1) / 2 - (pad.left - pad.right) / (2 * zoom);
  const vc = (v0 + v1) / 2 - (pad.bottom - pad.top) / (2 * zoom);
  const target = add(add(add([0, 0, 0], right, uc), up, vc), back, (w0 + w1) / 2);
  return { target, zoom, spanU, spanV };
}

/** Phones: Front and Side open at >= 3 px/in, anchored to the left end (pan to see the rest). */
export const PHONE_MAX_WIDTH = 480;
export const PHONE_ELEVATION_ZOOM = 3;

/** Room kept clear for the HTML overlay: the scale bar (bottom) and the height ticks (left of elevations). */
export const OVERLAY_INSETS = { scaleBar: 44, heightTicks: 64 };

export function overlayInsets(preset: PresetDef): Partial<Insets> {
  const elevation = preset.elevationDeg === 0;
  const bar = preset.name !== 'threeQuarter';
  return { bottom: bar ? OVERLAY_INSETS.scaleBar : 0, left: elevation ? OVERLAY_INSETS.heightTicks : 0 };
}

/** fitOrtho plus the overlay insets and the phone elevation rule (plan §7.2). */
export function fitPreset(points: readonly Vec3[], preset: PresetDef, viewW: number, viewH: number): OrthoFit {
  const base = defaultPadding(viewW, viewH);
  const extra = overlayInsets(preset);
  const pad: Insets = { ...base, bottom: base.bottom + (extra.bottom ?? 0), left: base.left + (extra.left ?? 0) };
  const fit = fitOrtho(points, preset, viewW, viewH, pad);
  const elevation = preset.elevationDeg === 0;
  if (!elevation || viewW > PHONE_MAX_WIDTH || fit.zoom >= PHONE_ELEVATION_ZOOM) return fit;
  const zoom = PHONE_ELEVATION_ZOOM;
  const { right } = screenBasis(presetDirection(preset), preset.azimuthDeg);
  const u0 = Math.min(...points.map((p) => dot(p, right)));
  // shift the target so the left end sits at the left padding
  const uTarget = u0 + (viewW / 2 - pad.left) / zoom;
  const shift = uTarget - dot(fit.target, right);
  return { ...fit, zoom, target: add(fit.target, right, shift) };
}

/** Shortest-path azimuth: an angle equivalent to `to` within ±π of `from`. */
export function nearestAngle(from: number, to: number): number {
  const TWO_PI = Math.PI * 2;
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return from + d;
}
