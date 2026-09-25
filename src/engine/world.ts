// Plan -> 3D world mapping (§7.2, ENG-28). The plan is y-down with its origin at
// the outside back-left corner; three.js is y-up. The world is centred on the
// plan's bounding box (ContactShadows renders at the world origin).
import type { Bounds } from './types';

export type Vec3 = [number, number, number];

export const planCentre = (b: Bounds): { cx: number; cy: number } => ({
  cx: (b.minX + b.maxX) / 2,
  cy: (b.minY + b.maxY) / 2,
});

/** planToWorld(x, y, h) = (x − cx, h, y − cy). */
export function planToWorld(x: number, y: number, h: number, centre: { cx: number; cy: number }): Vec3 {
  return [x - centre.cx + 0, h, y - centre.cy + 0];
}
