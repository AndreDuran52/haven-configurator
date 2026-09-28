// Loose back cushions (plan §7.4, Andre 2026-09-27), as pure data: they stand
// on the tight seat against the 10″ back frame, 8″ deep at the bottom, their
// tops 4″ above the frame (31″). One per ~36″ of seat, split evenly per piece;
// a wedge has one along each outside edge. Arms and tables have none.
import { BACK_CUSHION, BACK_CUSHION_SINK } from './profiles';
import { jitter, leaningBox, leaningTop, runInward, type OrientedBox, type RunFrame } from './softBox';
import type { BuildResult } from './types';

export interface BackCushion extends OrientedBox {
  key: string;
  pieceId: string;
}

/** Target width of one back cushion; a seat is split into round(len / 36) equal cushions. */
export const BACK_CUSHION_WIDTH = 36;
/** Lean back, degrees (each cushion varies by up to ±1° so they read as loose). */
export const BACK_CUSHION_LEAN = 4;
/** Visual gap between neighbouring cushions (and at a piece's ends). */
const GAP = 0.5;
/**
 * The soft shape three/softGeometry builds inside each box (inches), like the
 * showroom photos (Andre, 2026-09-27: "more square, straight at the top"):
 * front and back panels dome out `bulge` at the middle; a flat boxing band
 * with edges rounded to `radius`; the depth tapers to `taper` at the top; the
 * top crowns `crown` (0 = straight); the ends bow in by `bow` at the corners and
 * the corners pull in by `pinch`. Nothing grows past the box, so the peak below
 * depends on the radius, taper and boxing alone.
 */
export const BACK_CUSHION_SHAPE = { bulge: 1, radius: 1.75, taper: 0.9, crown: 0, bow: 0, pinch: 0.12 } as const;

/**
 * The box height whose soft top, leaning back by θ, peaks at `top` from
 * `bottom`. The top-front edge is a quarter-round of radius r whose centre sits
 * r below the box top and zc (the tapered boxing) in front of the middle; its
 * highest point rises r·√(cos²θ + taper²·sin²θ) above that centre.
 */
function heightFor(top: number, bottom: number, t: number, lean: number): number {
  const a = (lean * Math.PI) / 180;
  const { radius: r, taper, bulge } = BACK_CUSHION_SHAPE;
  const zc = taper * Math.max(0, t / 2 - bulge - r);
  const k = Math.hypot(Math.cos(a), taper * Math.sin(a));
  return (top - bottom - (t / 2) * Math.sin(a) - zc * Math.sin(a) + r * Math.cos(a) - k * r) / Math.cos(a);
}

export function backCushions(b: BuildResult): BackCushion[] {
  const d = b.heights;
  const F = d.backFrame;
  const z0 = d.seatHeight - BACK_CUSHION_SINK;
  const top = d.backHeight + BACK_CUSHION.rise;
  const t = BACK_CUSHION.depth;
  const out: BackCushion[] = [];
  // `look` keys the ±1° variation by position (run, index), not by id: ids are
  // renumbered when a link is opened, and a shared layout must look the same.
  const box = (key: string, look: string, pieceId: string, f: RunFrame, s: number, w: number, facing?: [number, number]) => {
    const lean = BACK_CUSHION_LEAN + jitter(look);
    const h = heightFor(top, z0, t, lean);
    out.push({ key, pieceId, ...leaningBox(f, s, F, z0, { w, h, t, lean }, facing) });
  };

  for (const p of b.pieces) {
    if (!p.run || (p.kind !== 'armless' && p.kind !== 'oneArm')) continue;
    const run = b.runs.find((r) => r.id === p.run)!;
    const f: RunFrame = { run: run.id, origin: run.origin, W: b.W };
    let a0 = p.offset!;
    let a1 = a0 + p.length;
    if (p.arm) {
      if (p.arm.at === 'end') a1 -= d.A;
      else a0 += d.A;
    }
    const len = a1 - a0;
    const n = Math.max(1, Math.round(len / BACK_CUSHION_WIDTH));
    const each = len / n;
    for (let i = 0; i < n; i++) box(`${p.id}:back${i}`, `${run.id}:${p.index}:${i}`, p.id, f, a0 + (i + 0.5) * each, each - GAP);
  }

  // Wedges: A along the back run's outside edge (it covers the corner), B along the leg's.
  for (const w of b.pieces) {
    if (w.kind !== 'wedge' || !w.corner) continue;
    const right = w.corner === 'backRight';
    const C = b.wedge.C;
    // Run-local frames whose s runs along each outside edge from the corner.
    const fA: RunFrame = { run: 'back', origin: [right ? b.W - C : 0, 0], W: b.W };
    const lenA = C - F - GAP / 2;
    box(`${w.id}:backA`, `${w.corner}:A`, w.id, fA, right ? C - F - lenA / 2 : F + lenA / 2, lenA - GAP / 2, runInward('back'));
    const fB: RunFrame = { run: right ? 'right' : 'left', origin: [0, 0], W: b.W };
    const lenB = C - (F + t + GAP) - GAP / 2;
    box(`${w.id}:backB`, `${w.corner}:B`, w.id, fB, F + t + GAP + lenB / 2, lenB - GAP / 2, runInward(fB.run));
  }
  return out;
}

/** The highest point of a leaning box (its top-front corner). */
export const boxTop = (c: OrientedBox): number => c.z + leaningTop(c.h, c.t, c.lean) / 2;
