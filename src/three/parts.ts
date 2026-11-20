// Engine pieces -> procedural 3D parts (plan §7.4), as pure data in PLAN inches
// (x, y) plus heights; block.ts and softGeometry.ts turn them into geometry.
// The real Haven (Andre, 2026-09-27): a tight seat, one upholstered block with a
// stitched seam at the deck (2026-11-20), an 8″ back frame 27″ tall (2026-11-18),
// 23″ arms, loose back cushions on the seat (engine/cushions.ts), inset legs.
// Run-local coordinates (s along the run, t depth from the back edge) map to plan:
//   back (s, t) · left leg (t, s) · right leg (W − t, s), each from the run origin.
import { backCushions, profiles, type BackCushion, type BuildResult, type BuiltPiece, type Pt, type Rect, type RunId, type TableStyle } from '@/engine';
import { fmtIn } from '@/plan/format';
import type { Edges } from './block';

export type MatId = 'body' | 'cushion' | 'wood' | 'leg';

export interface PrismPart {
  key: string;
  pieceId: string;
  poly: Pt[];
  z0: number;
  z1: number;
  /** Edge radii, puff and seam (block.ts). */
  edges: Edges;
  /** The footprint above the seam (the ⅛″ seam between neighbouring seats). */
  upper?: Pt[];
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

/** The seam between neighbouring pieces' seats above the stitching (below it they touch, so Top parity holds). */
const SEAM = 0.125;
/**
 * The upholstery (Andre, 2026-11-20, from his close-ups): edges rounded 1″ at the
 * top, ¾″ at the vertical corners, ½″ at the bottom; each half of the seat puffs
 * out `puff` from its ends, and the stitching pulls in `pinch` more. One place to tune.
 */
export const UPHOLSTERY = { top: 1, corner: 0.75, bottom: 0.5, puff: 0.2, pinch: 0.25 } as const;
/** Wood tops: square, the edges eased ⅛″. */
export const WOOD_EASE = 0.125;
const FLAT: Edges = { top: UPHOLSTERY.top, corner: UPHOLSTERY.corner, bottom: UPHOLSTERY.bottom };
const WOOD: Edges = { top: WOOD_EASE, corner: WOOD_EASE, bottom: WOOD_EASE };
/** A table base under its wood top: the top edge hidden by the wood, so barely eased (no shadow line, photo 2). */
const UNDER_WOOD: Edges = { ...FLAT, top: WOOD_EASE };
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

type Add = (piece: BuiltPiece, key: string, poly: Pt[], z0: number, z1: number, edges: Edges, mat: MatId, opts?: { loose?: boolean; upper?: Pt[] }) => void;

/** The tight seat: one upholstered block from the legs to the seat top, stitched at the deck. */
function tightSeat(add: Add, piece: BuiltPiece, foot: Pt[], upper: Pt[] | undefined, z0: number, deck: number, top: number) {
  add(piece, 'seat', foot, z0, top, { ...UPHOLSTERY, seamAt: deck }, 'cushion', upper ? { upper } : undefined);
}

export function buildParts(built: BuildResult, tableStyle: TableStyle = 'standard'): Parts {
  const out: Parts = { prisms: [], backs: backCushions(built), legs: [], decals: [] };
  const d = built.heights;
  const p = profiles(d);
  const { D, W } = built;
  const { A } = d;
  const F = d.backFrame;
  const frames = new Map(built.runs.map((r) => [r.id, { run: r.id, origin: r.origin, W } satisfies Frame]));
  const add: Add = (piece, key, poly, z0, z1, edges, mat, opts) =>
    out.prisms.push({ key: `${piece.id}:${key}`, pieceId: piece.id, poly, z0, z1, edges, mat, ...(opts?.upper ? { upper: opts.upper } : {}), ...(opts?.loose ? { loose: true } : {}) });

  for (const piece of built.pieces) {
    if (piece.kind === 'wedge') {
      wedgeParts(piece, built, add);
      out.legs.push(...cornerLegs(piece.id, piece.polygon, p.leg.z1));
      continue;
    }
    if (piece.kind === 'ottoman') {
      // One plain block, no seam (Andre, 2026-11-20).
      add(piece, 'seat', piece.polygon, p.leg.z1, p.ottoman.z1, FLAT, 'cushion', { loose: true });
      out.legs.push(...cornerLegs(piece.id, piece.polygon, p.leg.z1, true));
      continue;
    }
    if (piece.kind === 'coffeeTable') {
      const slab = 1.5;
      add(piece, 'top', piece.polygon, p.coffeeTable.z1 - slab, p.coffeeTable.z1, WOOD, 'wood', { loose: true });
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
      if (tableStyle === 'allWood') add(piece, 'top', foot, p.table.z0, p.table.z1, WOOD, 'wood');
      else {
        // The standard Haven table (Andre, 2026-11-20): one plain fabric block up to a
        // 2″ square wood top, flush with it on every side.
        add(piece, 'base', foot, p.tableBase.z0, p.tableBase.z1, UNDER_WOOD, 'body');
        add(piece, 'top', foot, p.tableTop.z0, p.tableTop.z1, WOOD, 'wood');
      }
      continue;
    }
    let a0 = s0;
    let a1 = s1;
    if (piece.arm) {
      const [c0, c1] = piece.arm.at === 'end' ? [s1 - A, s1] : [s0, s0 + A];
      add(piece, 'arm', rectST(f, c0, c1, 0, D), p.arm.z0, p.arm.z1, FLAT, 'body');
      if (piece.arm.at === 'end') a1 = c0;
      else a0 = c1;
    }
    // The 8″ back frame, 27″ tall; its end rises 4″ above the arm (as on the real Haven).
    add(piece, 'frame', rectST(f, a0, a1, 0, F), p.backFrame.z0, p.backFrame.z1, FLAT, 'body');
    tightSeat(add, piece, rectST(f, a0, a1, F, D), rectST(f, a0 + SEAM, a1 - SEAM, F, D), p.seatBase.z0, p.seatBase.z1, p.seat.z1);
  }
  for (const g of built.gaps) out.decals.push({ key: `gap:${g.run}:${g.index}`, rect: g.rect, label: `unfilled ${fmtIn(g.length)}` });
  return out;
}

/** Wedge: 8″ frames on both outside edges; the tight seat on the §8 polygon. */
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
  add(piece, 'frameA', R(0, 0, C, F), p.backFrame.z0, p.backFrame.z1, FLAT, 'body');
  add(piece, 'frameB', R(0, F, F, C), p.backFrame.z0, p.backFrame.z1, FLAT, 'body');
  const seat = m(dedupe([[F, F], [C, F], [C, D], [D, C], [F, C]]));
  tightSeat(add, piece, seat, undefined, p.seatBase.z0, p.seatBase.z1, p.seat.z1);
}
