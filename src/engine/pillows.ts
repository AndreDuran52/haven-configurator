// Throw pillow anchors (plan §7.4, 3D-07, Q15), as pure data from the built
// layout. Andre (2026-11-18, his styled Haven picture and showroom photo): at
// every arm end and every corner, two down-feather "karate chop" squares (one
// grey-taupe, one light; Andre's Blender model) standing up against the back
// cushions, the front one 2–3″ forward and overlapping the other by about a
// third, and one ball on the seat in front of them (cream at an arm end, taupe
// at a corner).
// They sit on the tight 18″ seat and lean on the loose back cushions: each
// back square starts inside what it leans on and slides forward until it just
// touches (softBox clearAlong); the front one leans on the back one. None at
// table or open ends; a spot too short (or shallow) gets fewer, never a
// pillow lying back more than 15° or touching nothing.
import { backCushions } from './cushions';
import { BACK_CUSHION } from './profiles';
import { boxCorners, boxDistance, boxesClash, clearAlong, leaningBox, planToRun, runAlong, runInward, runToPlanPt, type OrientedBox, type RunFrame } from './softBox';
import type { BuildResult, BuiltPiece, Pt } from './types';

export type PillowKind = 'square' | 'ball';
export type PillowTone = 'taupe' | 'oatmeal' | 'cream';

export interface PillowAnchor extends OrientedBox {
  key: string;
  kind: PillowKind;
  tone: PillowTone;
}

/** Pillow fabrics (Andre, 2026-11-18): a cool grey-taupe and a soft off-white linen, matte; cream bouclé balls (the 3D and the plan). */
export const PILLOW_COLOR: Record<PillowTone, string> = { taupe: '#8c8279', oatmeal: '#ebe6de', cream: '#eee8de' };

/**
 * 20″ down "karate chop" pillows: Andre's Blender model (three/models/
 * pillow-square.glb), fitted into this box. 6″ at the belly, standing up
 * 10° off upright like the taupe pillow in his showroom photo (2026-11-18),
 * so each takes about 9″ of seat; their bottoms on the seat just in front of
 * the back cushions, their tops resting on them.
 */
export const SQUARE_PILLOW = { w: 20, h: 20, t: 6, lean: 10 };
export const BALL_PILLOW = 11;
/** No square ever lies back further than this from upright (Andre, 2026-11-18). */
export const PILLOW_MAX_LEAN = 15;
/** How far a down pillow settles into the seat under it (Andre, 2026-11-20: resting on the seat, no more than ½″ in; a ball half of that). Its top ends about 7″ above the back cushions'. */
const SINK = 0.5;
/** The space kept between soft things that touch, inches. */
const PAD = 0.25;
/** How far a ball presses into the down squares behind it (their boxes are fuller than the pillows' tapered bottoms). */
const BALL_PRESS = 2;
/**
 * How far a down pillow presses into the soft back cushion it leans on, and
 * two pillows into each other where they touch, inches: the boxes are
 * conservative (pinched pillow edges, rounded cushion boxing), so this is
 * what makes the shapes meet instead of floating (Andre, 2026-09-28).
 */
export const PILLOW_PRESS = 2.5;
export const PAIR_PRESS = 2.5;
/** Yaw, degrees (Andre, 2026-11-18: "face straight out from the cushion they lean on", 0–8°): a little into the arm at an arm end, square at a corner. */
const YAW_ARM = 4;
const YAW_WEDGE = 0;
/** A pair (Andre, 2026-11-18): the two overlap by about a third of a pillow along the back, the front one this far forward. */
export const PAIR_OVERLAP = 1 / 3;
export const PAIR_FORWARD = 2.5;

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
  const tStart = F + BACK_CUSHION.reach - 2;
  const onCushions = (q: OrientedBox) => cushions.some((c) => boxesClash(q, c, -PILLOW_PRESS));
  // A ball rests against the cushions, and presses BALL_PRESS into the soft down squares in front of which it sits.
  const ballBlocked = (q: OrientedBox) => cushions.some((c) => boxDistance(c, [q.x, q.y, q.z]) < r + PAD) || squares.some((c) => boxDistance(c, [q.x, q.y, q.z]) < r - BALL_PRESS);
  const ballAt = ([x, y]: Pt): OrientedBox => ({ x, y, z: d.seatHeight - SINK / 2 + r, facing: [0, 1], lean: 0, w: BALL_PILLOW, h: BALL_PILLOW, t: BALL_PILLOW });
  const keep = (key: string, kind: PillowKind, tone: PillowTone, q: OrientedBox) => {
    if (kind === 'square') squares.push(q);
    out.push({ key, kind, tone, ...q });
  };
  const moved = (q: OrientedBox, v: Pt, k: number): OrientedBox => ({ ...q, x: q.x + v[0] * k, y: q.y + v[1] * k });

  const pressing = (q: OrientedBox, partner?: OrientedBox) => squares.some((c) => c !== partner && boxesClash(q, c, -PAIR_PRESS));
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
  /** Its top rests on something: a back cushion, or the square behind it. */
  const touches = (q: OrientedBox, behind?: OrientedBox) => cushions.some((c) => boxesClash(q, c)) || (!!behind && boxesClash(q, behind));
  /**
   * A pair along one back, from s0 going `dir`: `first` is the square nearer
   * s0 (its nearest corner `near` along), `second` the one a third of a pillow further along; the one named
   * `front` stands PAIR_FORWARD in front of the other, leaning on it.
   */
  const pair = (f: RunFrame, s0: number, dir: 1 | -1, yaw: number, front: 'first' | 'second', near: number) => {
    const inward = runInward(f.run);
    let a = resting(f, s0, dir, near, yaw);
    let c = resting(f, s0, dir, near + sq.w * (1 - PAIR_OVERLAP), yaw);
    if (front === 'first' && a) a = moved(a, inward, PAIR_FORWARD);
    if (front === 'second' && c) c = moved(c, inward, PAIR_FORWARD);
    return { first: a, second: c };
  };
  /** A ball on the seat: from `start`, slid `v` until it is clear of the cushions and squares. */
  const ballFrom = (start: Pt, v: Pt) => clearAlong(ballAt(start), v, ballBlocked, b.D);

  // Arm ends (Andre, 2026-11-18): the taupe square at the arm, in front; the
  // light one a third of a pillow further along, behind it; both turned a
  // little into the arm; a cream ball on the seat in front of them, by the arm.
  for (const p of b.pieces) {
    if (!p.arm || !p.run) continue;
    const run = b.runs.find((x) => x.id === p.run)!;
    const f: RunFrame = { run: run.id, origin: run.origin, W: b.W };
    const dir = p.arm.at === 'end' ? -1 : 1; // from the arm toward the seat
    const armInner = p.arm.at === 'end' ? p.offset! + p.length - d.A : p.offset! + d.A;
    const span = p.length - d.A;
    const within = (c: Pt | [number, number, number], m: number) => {
      const [s, t] = planToRun(f, c);
      const at = (s - armInner) * dir;
      return at >= m - 1e-6 && at <= span - m && t <= b.D - m;
    };
    const ok = (q: OrientedBox | null, partner?: OrientedBox, behind?: OrientedBox): q is OrientedBox =>
      !!q && q.lean <= PILLOW_MAX_LEAN && !pressing(q, partner) && touches(q, behind) && boxCorners(q).every((c) => within(c, 0.5));
    const { first: taupe, second: light } = pair(f, armInner, dir, YAW_ARM, 'first', 0.5);
    if (!ok(light)) continue;
    keep(`${p.id}:sq2`, 'square', 'oatmeal', light);
    if (!ok(taupe, light, light)) continue;
    keep(`${p.id}:sq1`, 'square', 'taupe', taupe);
    // The ball against the arm, slid forward until it is clear of the squares.
    const ball = ballFrom(runToPlanPt(f, armInner + dir * (0.5 + r), F + BACK_CUSHION.reach + r), runInward(f.run));
    if (ball && within([ball.x, ball.y], r + 0.5)) keep(`${p.id}:ball`, 'ball', 'cream', ball);
  }

  // Corner wedges (Andre, 2026-11-18): both squares against the back run's
  // cushion, facing straight out; the taupe one tucked into the corner (against
  // the leg's soft back cushion), the
  // light one a third of a pillow along and in front of it; a taupe ball on
  // the seat in front of the pair.
  for (const w of b.pieces.filter((q): q is BuiltPiece & { corner: NonNullable<BuiltPiece['corner']> } => q.kind === 'wedge' && q.corner !== null)) {
    const right = w.corner === 'backRight';
    const C = b.wedge.C;
    const m = ([x, y]: Pt): Pt => (right ? [b.W - x, y] : [x, y]);
    // The wedge's seat (§8 polygon, in the left corner's frame).
    const seat: Pt[] = [[F, F], [C, F], [C, b.D], [b.D, C], [F, C]];
    const ok = (q: OrientedBox | null, partner?: OrientedBox, behind?: OrientedBox): q is OrientedBox =>
      !!q && q.lean <= PILLOW_MAX_LEAN && !pressing(q, partner) && touches(q, behind) && boxCorners(q).every(([x, y]) => insideConvex(seat, m([x, y]), 0.5));
    const corner = F + BACK_CUSHION.reach; // the front of the leg's cushions
    const fA: RunFrame = { run: 'back', origin: [0, 0], W: b.W };
    const dirA = right ? -1 : 1;
    const { first: taupe, second: light } = pair(fA, right ? b.W - corner : corner, dirA, YAW_WEDGE, 'second', 0);
    if (!ok(taupe)) continue;
    keep(`${w.id}:sq1`, 'square', 'taupe', taupe);
    if (ok(light, taupe, taupe)) keep(`${w.id}:sq2`, 'square', 'oatmeal', light);
    // The ball in front of the pair, between them.
    const mid = light ? (taupe.x + light.x) / 2 : taupe.x;
    const ball = ballFrom([mid, corner + r], [0, 1]);
    if (ball && insideConvex(seat, m([ball.x, ball.y]), r + 0.5)) keep(`${w.id}:ball`, 'ball', 'taupe', ball);
  }
  return out;
}
