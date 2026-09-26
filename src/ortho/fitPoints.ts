// Silhouette points for the ortho fit (plan §7.2), from engine data only:
// every footprint corner at the floor-slab bottom and at the piece's top height.
// World = plan centred on its bounds: (x − cx, height, y − cy) (engine/world.ts).
import { pillowAnchors, pillowCorners, planCentre, planToWorld, type BuildResult, type Pt } from '@/engine';
import type { Vec3 } from './screenBasis';

/** The floor slab: top at −0.2″, 1.5″ thick (plan §7.3), so elevations show a ground band. */
export const FLOOR_TOP = -0.2;
export const FLOOR_THICKNESS = 1.5;
export const GAP_DECAL_HEIGHT = 0.1;

const rect = (r: { x: number; y: number; w: number; h: number }): Pt[] => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.h],
  [r.x, r.y + r.h],
];

/** `pillows`: include the pillow boxes (plan §10 H5: pillows join the ortho fit). */
export function fitPoints(built: BuildResult, opts: { loose: boolean; pillows?: boolean }): Vec3[] {
  const centre = planCentre(built.bounds);
  const bottom = FLOOR_TOP - FLOOR_THICKNESS;
  const out: Vec3[] = [];
  const push = (poly: Pt[], top: number) => {
    for (const [x, y] of poly) out.push(planToWorld(x, y, bottom, centre), planToWorld(x, y, top, centre));
  };
  for (const p of built.pieces) {
    const loose = p.kind === 'ottoman' || p.kind === 'coffeeTable';
    if (loose && !opts.loose) continue;
    push(p.polygon, p.height ?? built.heights.backHeight);
  }
  for (const g of built.gaps) push(rect(g.rect), GAP_DECAL_HEIGHT);
  if (opts.pillows) {
    for (const p of pillowAnchors(built)) for (const [x, y, h] of pillowCorners(p)) out.push(planToWorld(x, y, h, centre));
  }
  return out;
}
