// Engine pieces -> procedural 3D parts (plan §7.4), as pure data in PLAN inches
// (x, y) plus heights; prism.ts and softGeometry.ts turn them into geometry.
// The real Haven (Andre, 2026-09-27): a tight seat (a base and a flat band,
// the seam where their bevels meet at the 10″ deck), a 10″ back frame 27″ tall,
// 23″ arms, loose back cushions on the seat (engine/cushions.ts), inset legs.
// Run-local coordinates (s along the run, t depth from the back edge) map to plan:
//   back (s, t) · left leg (t, s) · right leg (W − t, s), each from the run origin.
import { backCushions, profiles, type BackCushion, type BuildResult, type BuiltPiece, type Pt, type Rect, type RunId, type TableStyle } from '@/engine';
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
  /** Loose back cushions (soft geometry, engine anchors). */
  backs: BackCushion[];
  legs: LegPart[];
  decals: DecalPart[];
}

/** The seam between neighbouring pieces' seat bands (the bases touch, so Top parity holds). */
const SEAM = 0.125;
/** Legs sit this far in from every outside edge: hidden under the body (Andre, 2026-09-27). */
export const LEG_INSET = 5;
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

/** A convex polygon moved `d` in from every edge (the leg positions). */
export function insetPolygon(poly: Pt[], d: number): Pt[] {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % n]!;
    area += x0 * y1 - x1 * y0;
  }
  const sign = area > 0 ? 1 : -1;
  // Inward unit normal of edge i (from vertex i to i + 1).
  const normal = (i: number): Pt => {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % n]!;
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return [(-(y1 - y0) / l) * sign, ((x1 - x0) / l) * sign];
  };
  return poly.map((v, i) => {
    const a = normal((i - 1 + n) % n);
    const b = normal(i);
    const k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [v[0] + (a[0] + b[0]) * k, v[1] + (a[1] + b[1]) * k];
  });
}

function cornerLegs(key: string, poly: Pt[], h: number, loose?: boolean): LegPart[] {
  return insetPolygon(poly, LEG_INSET).map(([x, y], i) => ({ key: `${key}:leg${i}`, x, y, h, ...(loose ? { loose } : {}) }));
}

type Add = (piece: BuiltPiece, key: string, poly: Pt[], z0: number, z1: number, r: number, mat: MatId, loose?: boolean) => void;

/** A tight upholstered block: base to the deck, a flat band above it; the bevels meet in the seam. */
function tightBlock(add: Add, piece: BuiltPiece, base: Pt[], band: Pt[], z0: number, deck: number, top: number, loose?: boolean) {
  add(piece, 'base', base, z0, deck, 1, 'body', loose);
  add(piece, 'seat', band, deck, top, 1.5, 'cushion', loose);
}

export function buildParts(built: BuildResult, tableStyle: TableStyle = 'standard'): Parts {
  const out: Parts = { prisms: [], backs: backCushions(built), legs: [], decals: [] };
  const d = built.heights;
  const p = profiles(d);
  const { D, W } = built;
  const { A } = d;
  const F = d.backFrame;
  const frames = new Map(built.runs.map((r) => [r.id, { run: r.id, origin: r.origin, W } satisfies Frame]));
  const add: Add = (piece, key, poly, z0, z1, r, mat, loose) =>
    out.prisms.push({ key: `${piece.id}:${key}`, pieceId: piece.id, poly, z0, z1, r, mat, ...(loose ? { loose } : {}) });

  for (const piece of built.pieces) {
    if (piece.kind === 'wedge') {
      wedgeParts(piece, built, add);
      out.legs.push(...cornerLegs(piece.id, piece.polygon, p.leg.z1));
      continue;
    }
    if (piece.kind === 'ottoman') {
      // Tight like the seat, with the same seam.
      tightBlock(add, piece, piece.polygon, piece.polygon, p.leg.z1, d.deckHeight, p.ottoman.z1, true);
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
      // 3D-01: a full-depth table, its top flush with the seat (Q9, 2026-09-27).
      const foot = rectST(f, s0, s1, 0, D);
      if (tableStyle === 'allWood') add(piece, 'top', foot, p.table.z0, p.table.z1, 0.5, 'wood');
      else {
        // The standard Haven table: a 2″ wood top on a fabric base with the seat's seam.
        add(piece, 'base', foot, p.tableBase.z0, d.deckHeight, 1, 'body');
        add(piece, 'band', rectST(f, s0 + SEAM, s1 - SEAM, 0, D), d.deckHeight, p.tableBase.z1, 1, 'body');
        add(piece, 'top', foot, p.tableTop.z0, p.tableTop.z1, 0.5, 'wood');
      }
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
    // The 10″ back frame, 27″ tall; its end rises 4″ above the arm (as on the real Haven).
    add(piece, 'frame', rectST(f, a0, a1, 0, F), p.backFrame.z0, p.backFrame.z1, 1.5, 'body');
    tightBlock(add, piece, rectST(f, a0, a1, F, D), rectST(f, a0 + SEAM, a1 - SEAM, F, D), p.seatBase.z0, p.seatBase.z1, p.seat.z1);
  }
  for (const g of built.gaps) out.decals.push({ key: `gap:${g.run}:${g.index}`, rect: g.rect, label: `unfilled ${fmtIn(g.length)}` });
  return out;
}

/** Wedge: 10″ frames on both outside edges; the tight seat on the §8 polygon. */
function wedgeParts(piece: BuiltPiece, built: BuildResult, add: Add) {
  const d = built.heights;
  const p = profiles(d);
  const { D, W } = built;
  const C = built.wedge.C;
  const F = d.backFrame;
  const right = piece.corner === 'backRight';
  const m = (poly: Pt[]): Pt[] => (right ? poly.map(([x, y]) => [W - x, y] as Pt).reverse() : poly);
  const R = (x0: number, y0: number, x1: number, y1: number): Pt[] => m([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const dedupe = (poly: Pt[]): Pt[] =>
    poly.filter((q, i) => {
      const n = poly[(i + 1) % poly.length]!;
      return q[0] !== n[0] || q[1] !== n[1];
    });
  add(piece, 'frameA', R(0, 0, C, F), p.backFrame.z0, p.backFrame.z1, 1.5, 'body');
  add(piece, 'frameB', R(0, F, F, C), p.backFrame.z0, p.backFrame.z1, 1.5, 'body');
  const seat = m(dedupe([[F, F], [C, F], [C, D], [D, C], [F, C]]));
  tightBlock(add, piece, seat, seat, p.seatBase.z0, p.seatBase.z1, p.seat.z1);
}
