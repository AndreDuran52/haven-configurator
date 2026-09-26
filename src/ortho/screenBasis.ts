// Screen basis and projection for an orthographic view, as plain vectors
// (no three.js), so it can be unit-tested and used by the entry chunk.
import type { PresetDef } from './presets';

export type Vec3 = [number, number, number];

const D2R = Math.PI / 180;
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const add = (a: Vec3, b: Vec3, s = 1): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

/** Unit vector from the target toward the camera. */
export function presetDirection(p: Pick<PresetDef, 'azimuthDeg' | 'elevationDeg'>): Vec3 {
  const th = p.azimuthDeg * D2R;
  const e = p.elevationDeg * D2R;
  return norm([Math.sin(th) * Math.cos(e), Math.sin(e), Math.cos(th) * Math.cos(e)]);
}

/**
 * Orthonormal screen basis for a view direction, matching what camera-controls
 * produces with camera.up = +y. At the pole (Top), θ = 0 gives screen-up = −z,
 * i.e. the plan's back at the top of the screen, like the SVG plan (E20b).
 */
export function screenBasis(dir: Vec3, azimuthDeg = 0): { right: Vec3; up: Vec3; back: Vec3 } {
  const back = norm(dir);
  let right: Vec3;
  if (Math.abs(back[1]) > 0.999999) {
    const th = azimuthDeg * D2R;
    right = [Math.cos(th), 0, -Math.sin(th)];
  } else {
    right = norm(cross([0, 1, 0], back));
  }
  const up = norm(cross(back, right));
  return { right, up, back };
}

/** Where a world point lands on screen (CSS px from the top-left of a w × h view). */
export function projectPoint(
  p: Vec3,
  view: { target: Vec3; zoom: number; basis: { right: Vec3; up: Vec3 } },
  w: number,
  h: number,
): [number, number] {
  const d: Vec3 = [p[0] - view.target[0], p[1] - view.target[1], p[2] - view.target[2]];
  return [w / 2 + dot(d, view.basis.right) * view.zoom, h / 2 - dot(d, view.basis.up) * view.zoom];
}
