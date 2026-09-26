// Pillow anchors (plan §7.4, 3D-07, Q15), as pure data from the built layout.
// Andre (2026-09-26): "pillows like the showroom photo": at each corner wedge
// and each arm end, two square pillows (taupe behind, cream in front, leaning
// on the back cushion) and one ball in front of them. None at table or open
// ends. A seat too short for a pillow gets fewer (never overlapping the arm).
import type { BuildResult, BuiltPiece, Pt } from './types';

export type PillowKind = 'square' | 'ball';
export type PillowTone = 'taupe' | 'cream';

export interface PillowAnchor {
  key: string;
  kind: PillowKind;
  tone: PillowTone;
  /** Centre in plan inches, and its height from the floor. */
  x: number;
  y: number;
  z: number;
  /** Unit vector (plan) the pillow's front faces: from the back toward the seat front. */
  facing: Pt;
  /** Degrees the top leans back (squares). */
  lean: number;
  /** Square: width, height, thickness. Ball: diameter in all three. */
  w: number;
  h: number;
  t: number;
}

export const SQUARE_PILLOW = { w: 20, h: 20, t: 6, lean: 16 };
export const BALL_PILLOW = 10;
/** How far a pillow sinks into the cushion under it. */
const SINK = 1;

type Frame = { run: 'back' | 'left' | 'right'; origin: Pt; W: number };

/** Run-local (s along the run, t from the outside edge) -> plan. */
function toPlan(f: Frame, s: number, t: number): Pt {
  if (f.run === 'back') return [f.origin[0] + s, t];
  if (f.run === 'left') return [t, f.origin[1] + s];
  return [f.W - t, f.origin[1] + s];
}

const inward = (run: Frame['run']): Pt => (run === 'back' ? [0, 1] : run === 'left' ? [1, 0] : [-1, 0]);

export function pillowAnchors(b: BuildResult): PillowAnchor[] {
  const d = b.heights;
  const B = d.B;
  const out: PillowAnchor[] = [];
  const sq = SQUARE_PILLOW;
  const squareZ = (seatTop: number) => seatTop - SINK + (sq.h / 2) * Math.cos((sq.lean * Math.PI) / 180);
  const ballZ = (seatTop: number) => seatTop - SINK / 2 + BALL_PILLOW / 2;
  const square = (key: string, tone: PillowTone, p: Pt, facing: Pt, seatTop: number) =>
    out.push({ key, kind: 'square', tone, x: p[0], y: p[1], z: squareZ(seatTop), facing, lean: sq.lean, w: sq.w, h: sq.h, t: sq.t });
  const ball = (key: string, tone: PillowTone, p: Pt, seatTop: number) =>
    out.push({ key, kind: 'ball', tone, x: p[0], y: p[1], z: ballZ(seatTop), facing: [0, 1], lean: 0, w: BALL_PILLOW, h: BALL_PILLOW, t: BALL_PILLOW });

  // Arm ends: the seat top next to the arm is the cushion's end height.
  const edge = d.deckHeight + d.cushionEdge;
  const tBack = B + sq.t / 2 + 0.5; // leaning on the back cushion
  for (const p of b.pieces) {
    if (!p.arm || !p.run) continue;
    const run = b.runs.find((r) => r.id === p.run)!;
    const f: Frame = { run: run.id, origin: run.origin, W: b.W };
    const cushion = p.length - d.A;
    const dir = p.arm.at === 'end' ? -1 : 1; // from the arm toward the cushion
    const armInner = p.arm.at === 'end' ? p.offset! + p.length - d.A : p.offset! + d.A;
    const at = (ds: number, t: number) => toPlan(f, armInner + dir * ds, t);
    const facing = inward(run.id);
    if (cushion >= sq.w + 2) square(`${p.id}:sq1`, 'taupe', at(sq.w / 2 + 1, tBack), facing, edge);
    if (cushion >= sq.w + 14) square(`${p.id}:sq2`, 'cream', at(sq.w / 2 + 13, tBack + 2), facing, edge);
    if (cushion >= BALL_PILLOW + 2 && b.D - B >= sq.t + BALL_PILLOW + 4) ball(`${p.id}:ball`, 'cream', at(BALL_PILLOW / 2 + 2, B + sq.t + BALL_PILLOW / 2 + 4), edge);
  }

  // Corner wedges: flat seat at the crown; one square on each back, the ball in front.
  const crown = d.deckHeight + d.cushionCrown;
  for (const w of b.pieces.filter((q): q is BuiltPiece & { corner: NonNullable<BuiltPiece['corner']> } => q.kind === 'wedge' && q.corner !== null)) {
    const right = w.corner === 'backRight';
    const m = (x: number, y: number): Pt => (right ? [b.W - x, y] : [x, y]);
    const mf = (f: Pt): Pt => (right ? [-f[0], f[1]] : f);
    const C = b.wedge.C;
    const alongA = Math.min(B + sq.w / 2 + 10, C - sq.w / 2 - 1); // on the back run's back cushion
    const alongB = Math.min(B + sq.w / 2 + 1, C - sq.w / 2 - 1); // on the leg's back cushion
    square(`${w.id}:sq1`, 'taupe', m(alongA, tBack), mf([0, 1]), crown);
    square(`${w.id}:sq2`, 'cream', m(tBack, alongB), mf([1, 0]), crown);
    const c = B + sq.t + BALL_PILLOW / 2 + 5;
    ball(`${w.id}:ball`, 'taupe', m(c, c), crown);
  }
  return out;
}

/** The 8 corners of a pillow's box in plan x, plan y and height (for the ortho fit). */
export function pillowCorners(p: PillowAnchor): [number, number, number][] {
  const out: [number, number, number][] = [];
  const lean = (p.lean * Math.PI) / 180;
  const [fx, fy] = p.facing;
  const [sx, sy] = [fy, -fx]; // along the pillow's width (plan)
  for (const a of [-1, 1]) for (const v of [-1, 1]) for (const c of [-1, 1]) {
    const across = (a * p.w) / 2;
    const up = (v * p.h) / 2;
    const thick = (c * p.t) / 2;
    // Lean: the top goes back (against `facing`).
    const fwd = thick * Math.cos(lean) - up * Math.sin(lean);
    const hgt = up * Math.cos(lean) + thick * Math.sin(lean);
    out.push([p.x + sx * across + fx * fwd, p.y + sy * across + fy * fwd, p.z + hgt]);
  }
  return out;
}
