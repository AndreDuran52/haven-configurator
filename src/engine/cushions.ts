// Loose back cushions (plan §7.4, Andre 2026-09-27; reshaped from his
// close-ups 2026-11-11), as pure data: they stand on the tight seat in front
// of the 10″ back frame, leaning back onto it, 8″ deep at the belly, their
// tops 4″ above the frame (31″). One per ~36″ of seat, split evenly per piece;
// a wedge has one along each outside edge. Arms and tables have none.
import { BACK_CUSHION, BACK_CUSHION_SINK } from './profiles';
import { jitter, leaningBox, leaningTop, runInward, type OrientedBox, type RunFrame } from './softBox';
import type { BuildResult, HavenDims } from './types';

export interface BackCushion extends OrientedBox {
  key: string;
  pieceId: string;
  /** For its soft shape (cushionFit): how far its foot stands in front of the frame, and the frame's top up the box. */
  fwd: number;
  frameUp: number;
}

/** Target width of one back cushion; a seat is split into round(len / 36) equal cushions. */
export const BACK_CUSHION_WIDTH = 36;
/** Lean back, degrees (each cushion varies by up to ±1° so they read as loose). Andre's close-ups, 2026-11-11: 10–15°. */
export const BACK_CUSHION_LEAN = 12;
/** Visual gap between neighbouring cushions (and at a piece's ends). */
const GAP = 0.5;
/** How far a leaning cushion's box foot reaches in front of BACK_CUSHION.depth (cushionFit's fwd, at most). */
const FOOT = 1;
/**
 * The soft shape built inside each box (engine/cushionProfile.ts), from
 * Andre's close-ups (2026-11-11), inches: "5″ at the stitching, filling to 8″"
 * = `bulge` per face; fullest at `belly` of the height and `top` of that
 * fullness at the top, which is a half-round; the bottom front rolls under by
 * `roll`; the top crowns `crown` between top corners rounded to `corner`; the
 * end's edges round to `edge`; the stitched seam sits `seam` in from each end.
 * Nothing grows past the box.
 */
export const BACK_CUSHION_SHAPE = { bulge: 1.5, belly: 0.35, top: 0.6, roll: 2.5, crown: 0.5, corner: 2.5, edge: 1, seam: 0.75 } as const;

export interface CushionFit {
  h: number;
  t: number;
  lean: number;
  /** The box's bottom-back edge: run-local depth and height. */
  tPivot: number;
  zPivot: number;
  /** tPivot in front of the back frame's face, and the frame's top up the box. */
  fwd: number;
  frameUp: number;
}

/**
 * The leaning box for a back cushion: its front bottom edge BACK_CUSHION_SINK
 * into the seat, its belly's front BACK_CUSHION.depth in front of the frame
 * (so the seat depth stays D − 18), its half-round top peaking at the back
 * height + rise (31″).
 */
export function cushionFit(d: HavenDims, lean: number): CushionFit {
  const a = (lean * Math.PI) / 180;
  const t = BACK_CUSHION.depth;
  const { bulge, top, roll } = BACK_CUSHION_SHAPE;
  const r = t / 2 - bulge + bulge * top; // the top's radius at mid-width
  const zPivot = d.seatHeight - BACK_CUSHION_SINK - t * Math.sin(a);
  const h = r + (d.backHeight + BACK_CUSHION.rise - zPivot - r - (t / 2) * Math.sin(a)) / Math.cos(a);
  // Leaning, the front is most forward just above its rolled-under bottom: that point stays BACK_CUSHION.depth in front of the frame.
  const fwd = t - t * Math.cos(a) + (roll + 0.7) * Math.sin(a);
  return { h, t, lean, tPivot: d.backFrame + fwd, zPivot, fwd, frameUp: (d.backHeight - zPivot) / Math.cos(a) };
}

export function backCushions(b: BuildResult): BackCushion[] {
  const d = b.heights;
  const F = d.backFrame;
  const t = BACK_CUSHION.depth;
  const out: BackCushion[] = [];
  // `look` keys the ±1° variation by position (run, index), not by id: ids are
  // renumbered when a link is opened, and a shared layout must look the same.
  const box = (key: string, look: string, pieceId: string, f: RunFrame, s: number, w: number, facing?: [number, number]) => {
    const fit = cushionFit(d, BACK_CUSHION_LEAN + jitter(look));
    out.push({ key, pieceId, fwd: fit.fwd, frameUp: fit.frameUp, ...leaningBox(f, s, fit.tPivot, fit.zPivot, { w, h: fit.h, t, lean: fit.lean }, facing) });
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
    // B starts clear of A's leaning box, whose foot stands FOOT in front of the 8″ line.
    const lenB = C - (F + t + FOOT + GAP) - GAP / 2;
    box(`${w.id}:backB`, `${w.corner}:B`, w.id, fB, F + t + FOOT + GAP + lenB / 2, lenB - GAP / 2, runInward(fB.run));
  }
  return out;
}

/** The highest point of a leaning box (its top-front corner). */
export const boxTop = (c: OrientedBox): number => c.z + leaningTop(c.h, c.t, c.lean) / 2;
