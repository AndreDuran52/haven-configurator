// Throw pillow anchors (plan §7.4, 3D-07, Q15), as pure data from the built
// layout. Andre (2026-09-27, with the showroom photos): a touching pair of
// down-feather "karate chop" squares (taupe + oatmeal linen) at each corner
// wedge and each arm end, and one light ball pillow on each wedge.
// They sit on the tight 18″ seat and lean on the loose back cushions: each one
// starts inside what it leans on and slides forward until it just touches
// (softBox clearAlong), so no pillow passes through a cushion or another pillow.
// None at table or open ends; a seat too short (or shallow) for one gets fewer.
import { backCushions } from './cushions';
import { BACK_CUSHION } from './profiles';
import { boxCorners, boxDistance, boxesClash, clearAlong, leaningBox, planToRun, runAlong, runInward, type OrientedBox, type RunFrame } from './softBox';
import type { BuildResult, BuiltPiece, Pt } from './types';

export type PillowKind = 'square' | 'ball';
export type PillowTone = 'taupe' | 'oatmeal' | 'cream' | 'mocha';

export interface PillowAnchor extends OrientedBox {
  key: string;
  kind: PillowKind;
  tone: PillowTone;
}

/**
 * 20″ down pillows, leaning back on the back cushions. 12″ deep: Andre's
 * Blender pillow (2026-09-27) as modelled (about 12½″; "thicker, like the og
 * Haven").
 */
export const SQUARE_PILLOW = { w: 20, h: 20, t: 12, lean: 10 };
export const BALL_PILLOW = 11;
/** How far a pillow sinks into the seat under it. */
const SINK = 1;
/** The space kept between soft things that touch, inches. */
const PAD = 0.25;
/** How far a down pillow presses into the soft back cushion it leans on, inches. */
export const PILLOW_PRESS = 1.5;
/** How far two down pillows in a pair press into each other where they touch, inches. */
export const PAIR_PRESS = 1;
/** The front pillow of a pair sits this much further forward than the other. */
const FRONT = 2;
/** Yaw, degrees: the corner pillow turns into its corner, the one beside it a little. */
const YAW_CORNER = 15;
const YAW_BESIDE = 5;

type Square = { tone: PillowTone; yaw: number; forward: number };

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
  const ballBlocked = (q: OrientedBox) => [...cushions, ...squares].some((c) => boxDistance(c, [q.x, q.y, q.z]) < r + PAD);
  const ballAt = ([x, y]: Pt): OrientedBox => ({ x, y, z: d.seatHeight - SINK / 2 + r, facing: [0, 1], lean: 0, w: BALL_PILLOW, h: BALL_PILLOW, t: BALL_PILLOW });
  const keep = (key: string, kind: PillowKind, tone: PillowTone, q: OrientedBox) => {
    if (kind === 'square') squares.push(q);
    out.push({ key, kind, tone, ...q });
  };
  const moved = (q: OrientedBox, v: Pt, k: number): OrientedBox => ({ ...q, x: q.x + v[0] * k, y: q.y + v[1] * k });

  /**
   * A touching pair along a straight back (Andre, 2026-09-27: "touch like in
   * the og Haven"): the first square at the corner end, turned into the
   * corner; the second beside it, slid along until the two just press
   * together. `forward` sets one of them a little in front of the other.
   * `s0` is where the corner end starts, `dir` the way along the back from it.
   */
  const pairAlong = (key: string, f: RunFrame, s0: number, dir: 1 | -1, ok: (q: OrientedBox) => boolean, pair: [Square, Square]) => {
    const inward = runInward(f.run);
    const along = runAlong(f.run).map((v) => v * dir) as Pt;
    const ds = (c: Pt | [number, number, number]) => (planToRun(f, c)[0] - s0) * dir;
    const pressing = (q: OrientedBox) => squares.some((c) => boxesClash(q, c, -PAIR_PRESS));
    const rest = (o: Square, near: number): OrientedBox | null => {
      const k = Math.tan((o.yaw * Math.PI) / 180);
      let q = leaningBox(f, s0, tStart, zPivot, sq, norm([inward[0] + along[0] * k, inward[1] + along[1] * k]));
      q = moved(q, along, near - Math.min(...boxCorners(q).map(ds)));
      const onBack = clearAlong(q, inward, onCushions, b.D);
      return onBack && moved(onBack, inward, o.forward);
    };
    const [a, c] = pair;
    // On a shallow seat the front one sits back against the cushions instead.
    const first = [a.forward, 0].map((forward) => rest({ ...a, forward }, 0.5)).find((q) => q && !pressing(q) && ok(q));
    if (!first) return;
    keep(`${key}:sq1`, 'square', a.tone, first);
    const farEnd = Math.max(...boxCorners(first).map(ds));
    // Along, away from the corner, until it only presses into the first; then clear of the cushions
    // again. Short backs: the second steps further forward, so it overlaps more of the first.
    for (const extra of [0, 3, 6, 9]) {
      let second = rest({ ...c, forward: c.forward + extra }, farEnd - sq.w / 2);
      second = second && clearAlong(second, along, pressing, sq.w);
      second = second && clearAlong(second, inward, onCushions, 6);
      if (second && !pressing(second) && ok(second)) return void keep(`${key}:sq2`, 'square', c.tone, second);
    }
  };

  // Arm ends: the taupe square at the arm, in front; the oatmeal one beside it, behind. No ball.
  for (const p of b.pieces) {
    if (!p.arm || !p.run) continue;
    const run = b.runs.find((x) => x.id === p.run)!;
    const f: RunFrame = { run: run.id, origin: run.origin, W: b.W };
    const dir = p.arm.at === 'end' ? -1 : 1; // from the arm toward the seat
    const armInner = p.arm.at === 'end' ? p.offset! + p.length - d.A : p.offset! + d.A;
    const span = p.length - d.A;
    const ok = (q: OrientedBox) =>
      boxCorners(q).every((c) => {
        const [s, t] = planToRun(f, c);
        const at = (s - armInner) * dir;
        return at >= 0.5 - 1e-6 && at <= span - 0.5 && t <= b.D - 0.5;
      });
    pairAlong(p.id, f, armInner, dir, ok, [
      { tone: 'taupe', yaw: YAW_CORNER, forward: FRONT },
      { tone: 'oatmeal', yaw: YAW_BESIDE, forward: 0 },
    ]);
  }

  // Corner wedges: the pair on the back run's cushion, the taupe one in the
  // corner (clear of the leg's cushion), the oatmeal one beside it, in front;
  // one light ball in the corner, in front of them.
  for (const w of b.pieces.filter((q): q is BuiltPiece & { corner: NonNullable<BuiltPiece['corner']> } => q.kind === 'wedge' && q.corner !== null)) {
    const right = w.corner === 'backRight';
    const C = b.wedge.C;
    const m = ([x, y]: Pt): Pt => (right ? [b.W - x, y] : [x, y]);
    // The wedge's seat (§8 polygon, in the left corner's frame).
    const seat: Pt[] = [[F, F], [C, F], [C, b.D], [b.D, C], [F, C]];
    const ok = (q: OrientedBox) => boxCorners(q).every(([x, y]) => insideConvex(seat, m([x, y]), 0.5));
    const corner = F + BACK_CUSHION.depth + 0.5;
    pairAlong(w.id, { run: 'back', origin: [0, 0], W: b.W }, right ? b.W - corner : corner, right ? -1 : 1, ok, [
      { tone: 'taupe', yaw: YAW_CORNER, forward: 0 },
      { tone: 'oatmeal', yaw: YAW_BESIDE, forward: FRONT },
    ]);
    const ball = clearAlong(ballAt(m([tStart, tStart])), norm([right ? -1 : 1, 1]), ballBlocked, C);
    if (ball && insideConvex(seat, m([ball.x, ball.y]), r + 0.5)) keep(`${w.id}:ball`, 'ball', 'cream', ball);
  }
  return out;
}
