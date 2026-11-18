// The square throw pillow for the pure drawings: Andre's Blender "karate chop"
// pillow (three/models/pillow-square.glb; Andre, 2026-11-18: "looks more
// realistic to what is in real life"), baked by scripts/pillow-outline.mjs
// into pillowBaked.ts, so the plan, the Side drawing and the 3D show the same
// shape. Plus the press of a back leaning on it (the pillow behind an upright
// person), shared by the 3D mesh (three/softGeometry pressPillow) and the
// Side drawing. In its box: x across (±w/2), y up (±h/2), z forward (±t/2).
// No three import.
import { PILLOW_BAKED } from './pillowBaked';

type Pt = [number, number];

/** A back leaning on the pillow: how far it presses the front in (inches), centred `at` up the pillow (−1 bottom … 1 top). */
export interface PillowPress {
  depth: number;
  at: number;
}

/**
 * How much of the front panel is left where a back presses on it, at (u, v),
 * each −1…1 across and up: 1 where nothing presses, down to 0.15 under the
 * middle of a hard press. The back panel is never pressed.
 */
export function pressAt(u: number, v: number, press: PillowPress, t: number): number {
  const g = Math.exp(-(((v - press.at) / 0.55) ** 2)) * Math.exp(-((u / 0.75) ** 2));
  return 1 - Math.min(0.85, press.depth / (t / 2)) * g;
}

/** The square pillow from above (leaning as the 3D leans it), [across, forward] from its box centre. */
export const pillowOutline = (): Pt[] => PILLOW_BAKED.outline.map(([x, y]): Pt => [x, y]);

/**
 * Its side silhouette, a closed loop in its box ([z, y]), scaled to h × t:
 * up the front (pressed where a back leans on it), down the back. The chop's
 * ears make the top.
 */
export function pillowProfile(h: number, t: number, press?: PillowPress): Pt[] {
  const { side } = PILLOW_BAKED;
  const sy = h / PILLOW_BAKED.h;
  const sz = t / PILLOW_BAKED.t;
  const n = side.y.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const z = side.front[i]! * sz;
    // Only the part of the front ahead of the box's middle gives under a back.
    const k = press && z > 0 ? pressAt(0, side.y[i]! / (PILLOW_BAKED.h / 2), press, t) : 1;
    out.push([z * k, side.y[i]! * sy]);
  }
  for (let i = n - 1; i >= 0; i--) out.push([side.back[i]! * sz, side.y[i]! * sy]);
  return out;
}
