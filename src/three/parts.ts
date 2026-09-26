// Engine pieces -> procedural 3D parts (plan §7.4), as pure data in PLAN inches
// (x, y) plus heights; prism.ts turns them into geometry. Run-local coordinates
// (s along the run, t depth from the back edge) map to plan as:
//   back (s, t) · left leg (t, s) · right leg (W − t, s), each from the run origin.
import { profiles, type BuildResult, type BuiltPiece, type Pt, type Rect, type RunId } from '@/engine';
import { fmtIn } from '@/plan/format';

export type MatId = 'body' | 'cushion' | 'wood' | 'leg';

export interface PrismPart {
  key: string;
  pieceId: string;
  poly: Pt[];
  z0: number;
  z1: number;
  r: number;
  mat: MatId;
  loose?: boolean;
}

/** A seat cushion whose top rises from `edge` at its ends to `crown` mid-span (plan §7.4). */
export interface CrownPart {
  key: string;
  pieceId: string;
  run: RunId;
  /** run origin on the outside edge, and W (for the right leg) */
  origin: Pt;
  W: number;
  s0: number;
  s1: number;
  t0: number;
  t1: number;
  z0: number;
  edge: number;
  crown: number;
  r: number;
}

export interface LegPart {
  key: string;
  x: number;
  y: number;
  h: number;
  loose?: boolean;
}

export interface DecalPart {
  key: string;
  rect: Rect;
  label: string;
}

export interface Parts {
  prisms: PrismPart[];
  crowns: CrownPart[];
  legs: LegPart[];
  decals: DecalPart[];
}

/** Visual seam between adjacent cushions. */
const GAP = 0.25;
const LEG_INSET = 3;
/** Pieces longer than this get a centre pair of legs (plan §6, 3D-05). */
const CENTRE_LEGS_OVER = 72;

type Frame = { run: RunId; origin: Pt; W: number };

export function runToPlan(f: Frame, s: number, t: number): Pt {
  if (f.run === 'back') return [f.origin[0] + s, t];
  if (f.run === 'left') return [t, f.origin[1] + s];
  return [f.W - t, f.origin[1] + s];
}

const rectST = (f: Frame, s0: number, s1: number, t0: number, t1: number): Pt[] => [
  runToPlan(f, s0, t0),
  runToPlan(f, s1, t0),
  runToPlan(f, s1, t1),
  runToPlan(f, s0, t1),
];

function centroid(poly: Pt[]): Pt {
  return [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
}

function insetToward(p: Pt, c: Pt, d: number): Pt {
  const dx = c[0] - p[0];
  const dy = c[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  return [p[0] + (dx / len) * d, p[1] + (dy / len) * d];
}

function cornerLegs(key: string, poly: Pt[], h: number, loose?: boolean): LegPart[] {
  const c = centroid(poly);
  return poly.map((p, i) => {
    const [x, y] = insetToward(p, c, LEG_INSET);
    return { key: `${key}:leg${i}`, x, y, h, ...(loose ? { loose } : {}) };
  });
}

export function buildParts(built: BuildResult): Parts {
  const out: Parts = { prisms: [], crowns: [], legs: [], decals: [] };
  const d = built.heights;
  const p = profiles(d);
  const { D, W } = built;
  const { B, A } = d;
  const F = d.backFrame;
  const frames = new Map(built.runs.map((r) => [r.id, { run: r.id, origin: r.origin, W } satisfies Frame]));
  const add = (piece: BuiltPiece, key: string, poly: Pt[], z0: number, z1: number, r: number, mat: MatId, loose?: boolean) =>
    out.prisms.push({ key: `${piece.id}:${key}`, pieceId: piece.id, poly, z0, z1, r, mat, ...(loose ? { loose } : {}) });

  for (const piece of built.pieces) {
    if (piece.kind === 'wedge') {
      wedgeParts(piece, built, add);
      out.legs.push(...cornerLegs(piece.id, piece.polygon, p.leg.z1));
      continue;
    }
    if (piece.kind === 'ottoman') {
      add(piece, 'body', piece.polygon, p.leg.z1, p.ottoman.z1, 2, 'cushion', true);
      out.legs.push(...cornerLegs(piece.id, piece.polygon, p.leg.z1, true));
      continue;
    }
    if (piece.kind === 'coffeeTable') {
      const slab = 1.5;
      add(piece, 'top', piece.polygon, p.coffeeTable.z1 - slab, p.coffeeTable.z1, 0.5, 'wood', true);
      out.legs.push(...cornerLegs(piece.id, piece.polygon, p.coffeeTable.z1 - slab, true));
      continue;
    }
    const f = frames.get(piece.run!)!;
    const s0 = piece.offset!;
    const s1 = s0 + piece.length;
    out.legs.push(...cornerLegs(piece.id, piece.polygon, p.leg.z1));
    if (piece.length > CENTRE_LEGS_OVER) {
      const mid = (s0 + s1) / 2;
      for (const t of [LEG_INSET, D - LEG_INSET]) {
        const [x, y] = runToPlan(f, mid, t);
        out.legs.push({ key: `${piece.id}:legMid${t}`, x, y, h: p.leg.z1 });
      }
    }
    if (piece.kind === 'table') {
      // 3D-01: a full-depth table; backs and cushions stop at it (Q12).
      add(piece, 'top', rectST(f, s0, s1, 0, D), p.table.z0, p.table.z1, 0.5, 'wood');
      continue;
    }
    let a0 = s0;
    let a1 = s1;
    if (piece.arm) {
      const [c0, c1] = piece.arm.at === 'end' ? [s1 - A, s1] : [s0, s0 + A];
      add(piece, 'arm', rectST(f, c0, c1, 0, D), p.arm.z0, p.arm.z1, 2, 'body');
      if (piece.arm.at === 'end') a1 = c0;
      else a0 = c1;
    }
    // The body starts behind the frame: no two parts share a face (no z-fighting).
    add(piece, 'body', rectST(f, a0, a1, F, D), p.body.z0, p.body.z1, 1, 'body');
    add(piece, 'frame', rectST(f, a0, a1, 0, F), p.backFrame.z0, p.backFrame.z1, 1.5, 'body');
    add(piece, 'back', rectST(f, a0 + GAP, a1 - GAP, F, B), p.backCushion.z0, p.backCushion.z1, 2.5, 'cushion');
    out.crowns.push({
      key: `${piece.id}:seat`,
      pieceId: piece.id,
      run: f.run,
      origin: f.origin,
      W,
      s0: a0 + GAP,
      s1: a1 - GAP,
      t0: B + GAP,
      t1: D,
      z0: p.seatCushion.z0,
      edge: p.seatCushion.edge,
      crown: p.seatCushion.crown,
      r: 2.5,
    });
  }
  for (const g of built.gaps) out.decals.push({ key: `gap:${g.run}:${g.index}`, rect: g.rect, label: `unfilled ${fmtIn(g.length)}` });
  return out;
}

/** Wedge: body inset 4″ on both outside edges; two frames + two back cushions; the §8 seat polygon. */
function wedgeParts(
  piece: BuiltPiece,
  built: BuildResult,
  add: (piece: BuiltPiece, key: string, poly: Pt[], z0: number, z1: number, r: number, mat: MatId) => void,
) {
  const d = built.heights;
  const p = profiles(d);
  const { D, W } = built;
  const C = built.wedge.C;
  const { B } = d;
  const F = d.backFrame;
  const right = piece.corner === 'backRight';
  const m = (poly: Pt[]): Pt[] => (right ? poly.map(([x, y]) => [W - x, y] as Pt).reverse() : poly);
  const R = (x0: number, y0: number, x1: number, y1: number): Pt[] => m([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const dedupe = (poly: Pt[]): Pt[] => poly.filter((q, i) => {
    const n = poly[(i + 1) % poly.length]!;
    return q[0] !== n[0] || q[1] !== n[1];
  });
  add(piece, 'body', m(dedupe([[F, F], [C, F], [C, D], [D, C], [F, C]])), p.body.z0, p.body.z1, 1, 'body');
  add(piece, 'frameA', R(0, 0, C, F), p.backFrame.z0, p.backFrame.z1, 1.5, 'body');
  add(piece, 'frameB', R(0, F, F, C), p.backFrame.z0, p.backFrame.z1, 1.5, 'body');
  add(piece, 'backA', R(F + GAP, F, C - GAP, B), p.backCushion.z0, p.backCushion.z1, 2.5, 'cushion');
  add(piece, 'backB', R(F, B + GAP, B, C - GAP), p.backCushion.z0, p.backCushion.z1, 2.5, 'cushion');
  const seat = dedupe([[B + GAP, B + GAP], [C - GAP, B + GAP], [C - GAP, D], [D, C - GAP], [B + GAP, C - GAP]]);
  add(piece, 'seat', m(seat), p.seatCushion.z0, p.seatCushion.crown, 2.5, 'cushion');
}
