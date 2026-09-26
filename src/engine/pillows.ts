// Throw pillow anchors (plan §7.4, 3D-07, Q15), as pure data from the built
// layout. Andre (2026-09-26/27): pillows like the showroom photos: at each
// corner wedge and each arm end, a taupe square in the corner, an oatmeal-linen
// square beside it (down-feather "karate chop" pillows), and a ball in front.
// They sit on the tight 18″ seat and lean on the loose back cushions: each one
// starts inside what it leans on and slides forward until it just touches
// (softBox clearAlong), so no pillow passes through a cushion or another pillow.
// None at table or open ends; a seat too short (or shallow) for one gets fewer.
import { backCushions } from './cushions';
import { BACK_CUSHION } from './profiles';
import { boxCorners, boxDistance, boxesClash, clearAlong, leaningBox, planToRun, runAlong, runInward, runToPlanPt, turn, type OrientedBox, type RunFrame } from './softBox';
import type { BuildResult, BuiltPiece, Pt } from './types';

export type PillowKind = 'square' | 'ball';
export type PillowTone = 'taupe' | 'oatmeal' | 'cream' | 'mocha';

export interface PillowAnchor extends OrientedBox {
  key: string;
  kind: PillowKind;
  tone: PillowTone;
}

/**
 * 20″ down pillows, leaning back on the back cushions. 9″ deep: Andre's Blender
 * pillow (2026-09-27) is plump (about 12″ as modelled), and 9″ keeps its look
 * while the Standard U and L keep every pillow.
 */
export const SQUARE_PILLOW = { w: 20, h: 20, t: 9, lean: 10 };
export const BALL_PILLOW = 11;
/** How far a pillow sinks into the seat under it. */
const SINK = 1;
/** The space kept between soft things that touch, inches. */
const PAD = 0.25;
/** How far a down pillow presses into the soft back cushion it leans on, inches. */
export const PILLOW_PRESS = 1.5;
/** Arm ends: both squares turn toward the middle of the seat (their backs to the corner), fanned. */
const YAW = 15;
const YAW2 = 10;
/** Arm ends: the second square starts this far along from the first (they overlap, the second in front). */
const STEP = 14;
/** Wedges: each square turns this far toward the room. */
const WEDGE_YAW = 10;
/** Wedges: how far the leg's square may slide along its back to clear the other one. */
const WEDGE_SLIDE = 12;

/** The 8 corners of a pillow's box (for the ortho fit). */
export const pillowCorners = boxCorners;

const norm = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

/** Is a point at least `margin` inside a convex polygon (either winding)? */
function insideConvex(poly: Pt[], [x, y]: Pt, margin: number): boolean {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    area += x0 * y1 - x1 * y0;
  }
  return poly.every(([x0, y0], i) => {
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return (Math.sign(area) * ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0))) / l >= margin;
  });
}

export function pillowAnchors(b: BuildResult): PillowAnchor[] {
  const d = b.heights;
  const sq = SQUARE_PILLOW;
  const r = BALL_PILLOW / 2;
  const F = d.backFrame;
  const out: PillowAnchor[] = [];
  const cushions = backCushions(b);
  const squares: OrientedBox[] = [];
  const zPivot = d.seatHeight - SINK;
  // Everything starts 2″ inside the back cushions, then slides forward.
  const tStart = F + BACK_CUSHION.depth - 2;
  const onCushions = (q: OrientedBox) => cushions.some((c) => boxesClash(q, c, -PILLOW_PRESS));
  const squareBlocked = (q: OrientedBox) => onCushions(q) || squares.some((c) => boxesClash(q, c, PAD));
  const ballBlocked = (q: OrientedBox) => [...cushions, ...squares].some((c) => boxDistance(c, [q.x, q.y, q.z]) < r + PAD);
  const ballAt = ([x, y]: Pt): OrientedBox => ({ x, y, z: d.seatHeight - SINK / 2 + r, facing: [0, 1], lean: 0, w: BALL_PILLOW, h: BALL_PILLOW, t: BALL_PILLOW });
  const keep = (key: string, kind: PillowKind, tone: PillowTone, q: OrientedBox) => {
    if (kind === 'square') squares.push(q);
    out.push({ key, kind, tone, ...q });
  };
  const moved = (q: OrientedBox, v: Pt, k: number): OrientedBox => ({ ...q, x: q.x + v[0] * k, y: q.y + v[1] * k });

  // Arm ends: the taupe square in the corner against the arm and the back
  // cushions, turned toward the seat; the oatmeal one fanned beside it, in
  // front where they overlap; the cream ball in front of the taupe one.
  for (const p of b.pieces) {
    if (!p.arm || !p.run) continue;
    const run = b.runs.find((x) => x.id === p.run)!;
    const f: RunFrame = { run: run.id, origin: run.origin, W: b.W };
    const dir = p.arm.at === 'end' ? -1 : 1; // from the arm toward the seat
    const armInner = p.arm.at === 'end' ? p.offset! + p.length - d.A : p.offset! + d.A;
    const span = p.length - d.A;
    const inward = runInward(run.id);
    const seatward = runAlong(run.id).map((v) => v * dir) as Pt;
    // Run-local: how far from the arm (ds) and how deep (t).
    const local = (c: Pt | [number, number, number]): Pt => {
      const [s, t] = planToRun(f, c);
      return [(s - armInner) * dir, t];
    };
    const onSeat = (q: OrientedBox) =>
      boxCorners(q).every((c) => {
        const [ds, t] = local(c);
        return ds >= 0.5 && ds <= span - 0.5 && t <= b.D - 0.5;
      });
    const square = (key: string, tone: PillowTone, near: number, yaw: number): boolean => {
      const k = Math.tan((yaw * Math.PI) / 180);
      const facing = norm([inward[0] + seatward[0] * k, inward[1] + seatward[1] * k]);
      let q = leaningBox(f, armInner, tStart, zPivot, sq, facing);
      q = moved(q, seatward, near - Math.min(...boxCorners(q).map((c) => local(c)[0])));
      const placed = clearAlong(q, inward, squareBlocked, b.D);
      if (!placed || !onSeat(placed)) return false;
      keep(key, 'square', tone, placed);
      return true;
    };
    if (!square(`${p.id}:sq1`, 'taupe', 0.5, YAW)) continue;
    square(`${p.id}:sq2`, 'oatmeal', 0.5 + STEP, YAW2);
    const ball = clearAlong(ballAt(runToPlanPt(f, armInner + dir * (r + 1.5), tStart)), inward, ballBlocked, b.D);
    const at = ball && local([ball.x, ball.y]);
    if (ball && at && at[0] + r <= span - 0.5 && at[1] + r <= b.D - 0.5) keep(`${p.id}:ball`, 'ball', 'cream', ball);
  }

  // Corner wedges: one square on each back cushion, turned toward the room
  // (the leg's one slides along its back, away from the corner, if the two
  // would touch); the mocha ball in front of them, on the diagonal.
  for (const w of b.pieces.filter((q): q is BuiltPiece & { corner: NonNullable<BuiltPiece['corner']> } => q.kind === 'wedge' && q.corner !== null)) {
    const right = w.corner === 'backRight';
    const C = b.wedge.C;
    const m = ([x, y]: Pt): Pt => (right ? [b.W - x, y] : [x, y]);
    // The wedge's seat (§8 polygon, in the left corner's frame).
    const seat: Pt[] = [[F, F], [C, F], [C, b.D], [b.D, C], [F, C]];
    const onSeat = (q: OrientedBox) => boxCorners(q).every(([x, y]) => insideConvex(seat, m([x, y]), 0.5));
    const along = Math.min(F + BACK_CUSHION.depth + sq.w / 2 + 11, C - sq.w / 2 - 1.5);
    const place = (key: string, tone: PillowTone, f: RunFrame, s: number, facing: Pt) => {
      let q = clearAlong(leaningBox(f, s, tStart, zPivot, sq, facing), runInward(f.run), onCushions, b.D);
      // Along the back, away from the corner: the back run's square goes first, so only the leg's one moves.
      if (q && f.run !== 'back') q = clearAlong(q, [0, 1], squareBlocked, WEDGE_SLIDE);
      if (q && !squareBlocked(q) && onSeat(q)) keep(key, 'square', tone, q);
    };
    place(`${w.id}:sq1`, 'taupe', { run: 'back', origin: [0, 0], W: b.W }, right ? b.W - along : along, turn([0, 1], right ? WEDGE_YAW : -WEDGE_YAW));
    const fB: RunFrame = { run: right ? 'right' : 'left', origin: [0, 0], W: b.W };
    if (C >= 50) place(`${w.id}:sq2`, 'oatmeal', fB, along, turn(runInward(fB.run), right ? -WEDGE_YAW : WEDGE_YAW));
    const ball = clearAlong(ballAt(m([tStart, tStart])), norm([right ? -1 : 1, 1]), ballBlocked, C);
    if (ball && insideConvex(seat, m([ball.x, ball.y]), r + 0.5)) keep(`${w.id}:ball`, 'ball', 'mocha', ball);
  }
  return out;
}
