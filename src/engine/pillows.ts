// Throw pillow anchors (plan §7.4, 3D-07, Q15), as pure data from the built
// layout. Andre (2026-09-27/28, showroom photos and his own top view): a
// touching pair of down-feather "karate chop" squares (taupe + oatmeal linen)
// at each corner wedge and each arm end, resting on the back cushions, and one
// light ball pillow on each wedge.
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
/**
 * How far a down pillow presses into the soft back cushion it leans on, and
 * two pillows into each other where they touch, inches: the boxes are
 * conservative (pinched pillow edges, rounded cushion boxing), so this is
 * what makes the shapes meet instead of floating (Andre, 2026-09-28).
 */
export const PILLOW_PRESS = 2.5;
export const PAIR_PRESS = 2.5;
/** Yaw, degrees (Andre's top view): arm-end squares turn into the arm corner; at a wedge the back run's square barely, the leg's one to face the room diagonal. */
const YAW_ARM = 15;
const YAW_WEDGE_BACK = 5;
const YAW_WEDGE_LEG = 35;

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

  const pressing = (q: OrientedBox) => squares.some((c) => boxesClash(q, c, -PAIR_PRESS));
  /**
   * A square resting on the back cushions of a straight back: turned `yaw`
   * into the corner (the end nearer `s0` swings forward), its nearest corner
   * `near` along from `s0` (going `dir`), slid forward until it only presses
   * into the cushions (PILLOW_PRESS). Andre (2026-09-28): "not floating away
   * from the back cushions".
   */
  const resting = (f: RunFrame, s0: number, dir: 1 | -1, near: number, yaw: number): OrientedBox | null => {
    const inward = runInward(f.run);
    const along = runAlong(f.run).map((v) => v * dir) as Pt;
    const ds = (c: Pt | [number, number, number]) => (planToRun(f, c)[0] - s0) * dir;
    const k = Math.tan((yaw * Math.PI) / 180);
    let q = leaningBox(f, s0, tStart, zPivot, sq, norm([inward[0] + along[0] * k, inward[1] + along[1] * k]));
    q = moved(q, along, near - Math.min(...boxCorners(q).map(ds)));
    return clearAlong(q, inward, onCushions, b.D);
  };
  /** Slide a square along its back (away from what it overlaps) until it only presses into the squares already placed, then settle it back on the cushions. */
  const besideAlong = (q: OrientedBox | null, f: RunFrame, dir: 1 | -1): OrientedBox | null => {
    const along = runAlong(f.run).map((v) => v * dir) as Pt;
    // Settling on a neighbouring cushion (each leans a little differently) can press it back into
    // the first square, so slide and settle until both hold.
    for (let i = 0; q && i < 4; i++) {
      q = clearAlong(q, along, pressing, sq.w + sq.t);
      q = q && clearAlong(q, runInward(f.run), onCushions, 6);
      if (q && !pressing(q)) return q;
    }
    return null;
  };

  // Arm ends (Andre's top view, 2026-09-28): the taupe square at the arm, the
  // light one just beyond it, both on the leg's cushions, touching, both
  // turned a little into the arm corner. No ball.
  for (const p of b.pieces) {
    if (!p.arm || !p.run) continue;
    const run = b.runs.find((x) => x.id === p.run)!;
    const f: RunFrame = { run: run.id, origin: run.origin, W: b.W };
    const dir = p.arm.at === 'end' ? -1 : 1; // from the arm toward the seat
    const armInner = p.arm.at === 'end' ? p.offset! + p.length - d.A : p.offset! + d.A;
    const span = p.length - d.A;
    const ok = (q: OrientedBox | null): q is OrientedBox =>
      !!q &&
      !pressing(q) &&
      boxCorners(q).every((c) => {
        const [s, t] = planToRun(f, c);
        const at = (s - armInner) * dir;
        return at >= 0.5 - 1e-6 && at <= span - 0.5 && t <= b.D - 0.5;
      });
    const first = resting(f, armInner, dir, 0.5, YAW_ARM);
    if (!ok(first)) continue;
    keep(`${p.id}:sq1`, 'square', 'taupe', first);
    const second = besideAlong(resting(f, armInner, dir, 0.5 + sq.w / 2, YAW_ARM), f, dir);
    if (ok(second)) keep(`${p.id}:sq2`, 'square', 'oatmeal', second);
  }

  // Corner wedges (Andre's top view, 2026-09-28): the light square on the back
  // run's cushion, tucked into the corner against the leg's; the taupe one on
  // the leg's cushion below it, turned to face the room diagonal, its corner
  // end resting on the light one; the light ball beside the light square.
  for (const w of b.pieces.filter((q): q is BuiltPiece & { corner: NonNullable<BuiltPiece['corner']> } => q.kind === 'wedge' && q.corner !== null)) {
    const right = w.corner === 'backRight';
    const C = b.wedge.C;
    const m = ([x, y]: Pt): Pt => (right ? [b.W - x, y] : [x, y]);
    // The wedge's seat (§8 polygon, in the left corner's frame).
    const seat: Pt[] = [[F, F], [C, F], [C, b.D], [b.D, C], [F, C]];
    const ok = (q: OrientedBox | null): q is OrientedBox => !!q && !pressing(q) && boxCorners(q).every(([x, y]) => insideConvex(seat, m([x, y]), 0.5));
    const corner = F + BACK_CUSHION.depth; // the front of the other back's cushions
    const fA: RunFrame = { run: 'back', origin: [0, 0], W: b.W };
    const dirA = right ? -1 : 1;
    const light = resting(fA, right ? b.W - corner : corner, dirA, 0.5, YAW_WEDGE_BACK);
    if (!ok(light)) continue;
    keep(`${w.id}:sq1`, 'square', 'oatmeal', light);
    const fB: RunFrame = { run: right ? 'right' : 'left', origin: [0, 0], W: b.W };
    const taupe = besideAlong(resting(fB, corner, 1, 0.5, YAW_WEDGE_LEG), fB, 1);
    if (ok(taupe)) keep(`${w.id}:sq2`, 'square', 'taupe', taupe);
    // The ball beside the light square, along the back run, just clear of it.
    const start = m([m([light.x, light.y])[0], corner + r + 2]);
    const ball = clearAlong(ballAt(start), [dirA, 0], ballBlocked, sq.w);
    if (ball && insideConvex(seat, m([ball.x, ball.y]), r + 0.5)) keep(`${w.id}:ball`, 'ball', 'cream', ball);
  }
  return out;
}
