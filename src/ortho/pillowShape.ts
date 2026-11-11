// The knife-edge throw pillow (Andre's close-ups, 2026-11-11): plain, no chop,
// full in the middle and thinning to a seam at its edges, the corners coming
// to soft points. One pure definition for the 3D mesh (three/softGeometry),
// the plan's footprint (plan/pillowShapes) and the Side drawing, so they agree.
// In its box: x across (±w/2), y up (±h/2), z forward (±t/2). No three import.

export type P3 = [number, number, number];
type Pt = [number, number];

/** A back leaning on the pillow: how far it presses the front in (inches), centred `at` up the pillow (−1 bottom … 1 top). */
export interface PillowPress {
  depth: number;
  at: number;
}

/** How full the pillow is at (u, v), each −1…1: 1 in the middle, 0 along the seam. */
const fill = (u: number, v: number) => (Math.cos((u * Math.PI) / 2) * Math.cos((v * Math.PI) / 2)) ** 0.45;

/** A point of the pillow's front (side 1) or back (side −1) panel. */
export function pillowPoint(w: number, h: number, t: number, u: number, v: number, side: 1 | -1, press?: PillowPress): P3 {
  // The sides draw in a little between the corners, as a stuffed square does.
  // …and the corners come to soft points, not sharp ones.
  const soft = 1 - 0.02 * (u * u * v * v) ** 3;
  const x = ((u * w) / 2) * (1 - 0.05 * (1 - v * v)) * soft;
  const y = ((v * h) / 2) * (1 - 0.05 * (1 - u * u)) * soft;
  let z = (side * t * fill(u, v)) / 2;
  if (press && side > 0) {
    const g = Math.exp(-(((v - press.at) / 0.55) ** 2)) * Math.exp(-((u / 0.75) ** 2));
    z *= 1 - Math.min(0.85, press.depth / (t / 2)) * g;
  }
  return [x, y, z];
}

/** Its side profile through the middle, a closed loop in the box ([z, y]): up the front, down the back. */
export function pillowProfile(h: number, t: number, press?: PillowPress, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const p = pillowPoint(1, h, t, 0, (i / n) * 2 - 1, 1, press);
    out.push([p[2], p[1]]);
  }
  for (let i = n - 1; i > 0; i--) {
    const p = pillowPoint(1, h, t, 0, (i / n) * 2 - 1, -1, press);
    out.push([p[2], p[1]]);
  }
  return out;
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** The convex outline of a set of points (monotone chain). */
export function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (src: Pt[]) => {
    const out: Pt[] = [];
    for (const q of src) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half(p.reverse())];
}

/**
 * The pillow seen from straight above when it leans back by `lean` degrees
 * (as the 3D places it: three/softGeometry boxTransform): its convex outline
 * in pillow inches, [across, forward] from the box centre.
 */
export function pillowOutline(sq: { w: number; h: number; t: number; lean: number }, n = 16): Pt[] {
  const a = (sq.lean * Math.PI) / 180;
  const pts: Pt[] = [];
  for (const side of [1, -1] as const)
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = pillowPoint(sq.w, sq.h, sq.t, (i / n) * 2 - 1, (j / n) * 2 - 1, side);
        pts.push([x, z * Math.cos(a) - y * Math.sin(a)]);
      }
  return hull(pts).map(([x, y]): Pt => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
}
