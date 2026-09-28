// Soft things that lean (loose back cushions, throw pillows), as oriented
// boxes in plan inches + height: pure data the 3D view fills with geometry and
// the ortho fit uses for its silhouette points.
import type { Pt } from './types';

export interface OrientedBox {
  /** Centre in plan inches, and its height from the floor. */
  x: number;
  y: number;
  z: number;
  /** Unit vector (plan) the front faces: from the back toward the seat front. */
  facing: Pt;
  /** Degrees the top leans back (away from `facing`). */
  lean: number;
  /** Width (across `facing`), height, thickness (along `facing`). */
  w: number;
  h: number;
  t: number;
}

export type RunFrame = { run: 'back' | 'left' | 'right'; origin: Pt; W: number };

/** Run-local (s along the run, t from the outside edge) -> plan. */
export function runToPlanPt(f: RunFrame, s: number, t: number): Pt {
  if (f.run === 'back') return [f.origin[0] + s, t];
  if (f.run === 'left') return [t, f.origin[1] + s];
  return [f.W - t, f.origin[1] + s];
}

/** The inward direction of a run (plan): from its back toward its seat front. */
export const runInward = (run: RunFrame['run']): Pt => (run === 'back' ? [0, 1] : run === 'left' ? [1, 0] : [-1, 0]);

/** The direction of increasing s along a run (plan). */
export const runAlong = (run: RunFrame['run']): Pt => (run === 'back' ? [1, 0] : [0, 1]);

const D2R = Math.PI / 180;

/**
 * Where the centre of a box leaning back by `lean` sits, relative to its
 * bottom-back edge (the pivot resting on the seat, against what is behind it):
 * `fwd` along the facing direction and `up`.
 */
export function leaningCentre(h: number, t: number, lean: number): { fwd: number; up: number } {
  const a = lean * D2R;
  return { fwd: (t / 2) * Math.cos(a) - (h / 2) * Math.sin(a), up: (h / 2) * Math.cos(a) + (t / 2) * Math.sin(a) };
}

/** The height of a leaning box's highest corner above its pivot. */
export const leaningTop = (h: number, t: number, lean: number): number => h * Math.cos(lean * D2R) + t * Math.sin(lean * D2R);

/** A box resting with its bottom-back edge at run-local (s, tPivot), height zPivot, leaning back. */
export function leaningBox(f: RunFrame, s: number, tPivot: number, zPivot: number, dims: { w: number; h: number; t: number; lean: number }, facing: Pt = runInward(f.run)): OrientedBox {
  const c = leaningCentre(dims.h, dims.t, dims.lean);
  const [px, py] = runToPlanPt(f, s, tPivot);
  return { x: px + facing[0] * c.fwd, y: py + facing[1] * c.fwd, z: zPivot + c.up, facing, lean: dims.lean, w: dims.w, h: dims.h, t: dims.t };
}

export type V3 = [number, number, number];

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A box's centre, its unit axes (across, up, thick) and half extents along them. */
export function boxFrame(p: OrientedBox): { c: V3; axes: [V3, V3, V3]; half: V3 } {
  const a = p.lean * D2R;
  const [fx, fy] = p.facing;
  // Lean: the top goes back (against `facing`), so `up` tips back and `thick` tips up.
  return {
    c: [p.x, p.y, p.z],
    axes: [
      [fy, -fx, 0],
      [-fx * Math.sin(a), -fy * Math.sin(a), Math.cos(a)],
      [fx * Math.cos(a), fy * Math.cos(a), Math.sin(a)],
    ],
    half: [p.w / 2, p.h / 2, p.t / 2],
  };
}

/** The 8 corners of an oriented box in plan x, plan y and height. */
export function boxCorners(p: OrientedBox): V3[] {
  const { c, axes, half } = boxFrame(p);
  const out: V3[] = [];
  for (const a of [-1, 1]) for (const v of [-1, 1]) for (const k of [-1, 1]) {
    const m = [a * half[0], v * half[1], k * half[2]] as const;
    out.push([0, 1, 2].map((i) => c[i]! + axes[0][i]! * m[0] + axes[1][i]! * m[1] + axes[2][i]! * m[2]) as V3);
  }
  return out;
}

/** Distance from a point to a box (0 inside it). */
export function boxDistance(p: OrientedBox, q: V3): number {
  const { c, axes, half } = boxFrame(p);
  const d: V3 = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
  let s = 0;
  for (let i = 0; i < 3; i++) s += Math.max(0, Math.abs(dot(d, axes[i]!)) - half[i]!) ** 2;
  return Math.sqrt(s);
}

/** Do two boxes overlap, or come closer than `gap` along every separating axis (SAT)? */
export function boxesClash(a: OrientedBox, b: OrientedBox, gap = 0): boolean {
  const A = boxFrame(a);
  const B = boxFrame(b);
  const d: V3 = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  const axes: V3[] = [...A.axes, ...B.axes];
  for (const u of A.axes) {
    for (const v of B.axes) {
      const x: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(...x);
      if (l > 1e-6) axes.push([x[0] / l, x[1] / l, x[2] / l]);
    }
  }
  const reach = (f: typeof A, L: V3) => f.axes.reduce((s, ax, i) => s + f.half[i]! * Math.abs(dot(ax, L)), 0);
  return axes.every((L) => Math.abs(dot(d, L)) <= reach(A, L) + reach(B, L) + gap);
}

/**
 * The smallest move `k` in [0, max] along the plan direction `v` that frees a
 * box (`blocked` false), found by bisection; null when even `max` is blocked.
 * Soft things start inside what they lean on and slide forward until they touch.
 */
export function clearAlong(p: OrientedBox, v: Pt, blocked: (q: OrientedBox) => boolean, max: number): OrientedBox | null {
  const at = (k: number): OrientedBox => ({ ...p, x: p.x + v[0] * k, y: p.y + v[1] * k });
  if (!blocked(p)) return p;
  if (blocked(at(max))) return null;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (blocked(at(m))) lo = m;
    else hi = m;
  }
  return at(hi);
}

/** Plan -> run-local (s along the run, t from the outside edge). */
export function planToRun(f: RunFrame, [x, y]: Pt | V3): Pt {
  if (f.run === 'back') return [x - f.origin[0], y];
  if (f.run === 'left') return [y - f.origin[1], x];
  return [y - f.origin[1], f.W - x];
}

/** Rotate a plan unit vector by `deg` (counter-clockwise in plan x/y). */
export function turn(v: Pt, deg: number): Pt {
  const a = deg * D2R;
  return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
}

/** A small deterministic number in [−1, 1] from a key (varied, repeatable looks). */
export function jitter(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}
