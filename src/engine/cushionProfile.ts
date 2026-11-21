// The back cushion's soft shape (Andre's close-ups, 2026-11-11): one pure
// definition that the 3D mesh (three/softGeometry), the Side drawing
// (ortho/sideSection) and the person's contact all read, so they agree.
// Inside its leaning box (BACK_CUSHION_SHAPE, cushionFit): 5″ at the
// stitching filling to 8″ at a low forward belly, a little slimmer toward a
// half-round top, the bottom front rolled under, the back pressed flat where
// it meets the frame, the underside lying flat on the seat (2026-11-20). Not in the engine barrel: import it by this path (it
// loads with the 3D view and the Side drawing, never the entry chunk).
import { BACK_CUSHION_SHAPE as S, cushionFit, cushionLean, type CushionFit as Fit, type HavenDims, type Pt } from './index';

/** What the shape needs of a cushion's fit (a placed cushion's box carries it: BackCushion). */
export type CushionFit = Pick<Fit, 'h' | 't' | 'lean' | 'fwd' | 'frameUp'>;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const rad = (deg: number) => (deg * Math.PI) / 180;

/** How softly the back turns where the frame stops pressing it (a smooth minimum, inches; the back gives the frame that much less). */
const CREASE = 0.5;

/** The top edge's height up the box at across position x (0 = the middle): crowned, the corners rounded off. */
export function cushionTop(fit: CushionFit, w: number, x: number): number {
  const R = Math.min(S.corner, w / 2 - 0.1);
  const e = Math.max(0, Math.abs(x) - (w / 2 - R));
  return fit.h - S.crown * ((2 * x) / w) ** 2 - (R - Math.sqrt(Math.max(0, R * R - e * e)));
}

/** Half the body's thickness at across position x and v up the box (0–1), before the top and bottom round off. */
function body(fit: CushionFit, w: number, x: number, v: number): number {
  const e = clamp((Math.abs(x) - (w / 2 - S.edge)) / S.edge, 0, 1);
  const core = fit.t / 2 - S.bulge - S.edge + S.edge * Math.sqrt(1 - e * e);
  const full = S.top + (1 - S.top) * Math.exp(-(((v - S.belly) / 0.35) ** 2));
  return core + S.bulge * (1 - ((2 * x) / w) ** 4) * full;
}

/**
 * Half the thickness in front of (side 1) or behind (side −1) the box's middle
 * plane, at across position x and `up` inches up the box. `inset` pulls the
 * surface in (the stitched seam).
 */
export function cushionHalf(fit: CushionFit, w: number, x: number, up: number, side: 1 | -1, inset = 0): number {
  const H = cushionTop(fit, w, x) - inset;
  const T = body(fit, w, x, 1);
  let half = body(fit, w, x, clamp(up / fit.h, 0, 1));
  // The half-round top.
  const q = clamp((up - (H - T)) / T, 0, 1);
  half *= Math.sqrt(1 - q * q);
  // The bottom rolls under at the front; a small radius at the back.
  const R = side > 0 ? S.roll : S.edge;
  if (up < R) half -= R - Math.sqrt(R * R - (R - up) ** 2);
  if (side < 0) {
    // Pressed flat against the frame's face, up to its top; free above it.
    const a = rad(fit.lean);
    // …easing off smoothly from just under the frame's top to 2″ above it.
    const k = clamp((fit.frameUp + 2 - up) / 3, 0, 1);
    const press = Math.max(0, (up * Math.sin(a) - fit.fwd) / Math.cos(a)) * k * k * (3 - 2 * k);
    // A soft crease where it comes off the frame, not a notch.
    const lim = fit.t / 2 + CREASE - press;
    const h = Math.max(CREASE - Math.abs(half - lim), 0) / CREASE;
    half = Math.min(half, lim) - (h * h * CREASE) / 4;
  }
  return Math.max(0, half - inset);
}

/** Heights up the box for one ring: close together through the rolled bottom and the round top. */
function ringUps(H: number, T: number, n: { roll: number; mid: number; top: number }): number[] {
  const out: number[] = [];
  const R = Math.min(S.roll, (H - T) / 2);
  for (let i = 0; i < n.roll; i++) out.push(R * (1 - Math.cos(((i / n.roll) * Math.PI) / 2)));
  for (let i = 0; i < n.mid; i++) out.push(R + ((H - T - R) * i) / n.mid);
  for (let i = 0; i < n.top; i++) out.push(H - T + T * Math.sin(((i / n.top) * Math.PI) / 2));
  return out;
}

export const RING = { roll: 5, mid: 10, top: 9 } as const;

/**
 * One closed ring round the cushion at across position x, in the box's own
 * frame ([z, y]: z forward from the middle plane, y up from the box centre):
 * up the front, over the top, down the back. Every ring has the same count.
 */
export function cushionRing(fit: CushionFit, w: number, x: number, inset = 0): Pt[] {
  const H = cushionTop(fit, w, x) - inset;
  const ups = ringUps(H, body(fit, w, x, 1), RING);
  const at = (up: number, side: 1 | -1): Pt => rested(fit, [side * cushionHalf(fit, w, x, up, side, inset), up - fit.h / 2]);
  return [...ups.map((u) => at(u, 1)), [0, H - fit.h / 2], ...ups.reverse().map((u) => at(u, -1))];
}

/**
 * The cushion rests on the seat (Andre, 2026-11-20): its leaning box's front
 * bottom edge is on the rest plane (BACK_CUSHION_SINK into the seat) and its
 * back bottom edge would be t·sin(lean) under it, so whatever falls below the
 * plane is lifted straight up onto it: a flat underside on the seat, the
 * rolled front edge above it, nothing through the seat.
 */
function rested(fit: CushionFit, [z, y]: Pt): Pt {
  const a = rad(fit.lean);
  const under = fit.t * Math.sin(a) - ((y + fit.h / 2) * Math.cos(a) + (z + fit.t / 2) * Math.sin(a));
  return under > 0 ? [z + under * Math.sin(a), y + under * Math.cos(a)] : [z, y];
}

/** Box frame -> the side plane (t from the sofa's back, z above the floor). */
export function cushionToSide(fit: Fit, [z, y]: Pt): Pt {
  const a = rad(fit.lean);
  const zb = z + fit.t / 2;
  const yb = y + fit.h / 2;
  return [fit.tPivot + zb * Math.cos(a) - yb * Math.sin(a), fit.zPivot + yb * Math.cos(a) + zb * Math.sin(a)];
}

export interface CushionSide {
  fit: Fit;
  /** The cushion's outline through its middle, in the side plane. */
  outline: Pt[];
  /** Where its front face is (t) at a height z; behind the frame's face above its top. */
  front: (z: number) => number;
  /** Its highest point (t, z). */
  peak: Pt;
}

/** The cushion as the Side drawing and the person see it: cut through the middle of a 36″ cushion at the nominal lean. */
export function cushionSide(d: HavenDims, lean: number = cushionLean(d)): CushionSide {
  const fit = cushionFit(d, lean);
  const ring = cushionRing(fit, 36, 0);
  const outline = ring.map((p) => cushionToSide(fit, p));
  const n = RING.roll + RING.mid + RING.top;
  const face = outline.slice(0, n + 1); // the front, bottom to top
  const peak = outline.reduce((m, p) => (p[1] > m[1] ? p : m));
  const front = (z: number): number => {
    let best = -Infinity;
    for (let i = 0; i < face.length - 1; i++) {
      const [a, b] = [face[i]!, face[i + 1]!];
      if ((z - a[1]) * (z - b[1]) > 0 || a[1] === b[1]) continue;
      best = Math.max(best, a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
    }
    return best === -Infinity ? (z > peak[1] ? -Infinity : face[0]![0]) : best;
  };
  return { fit, outline, front, peak };
}
