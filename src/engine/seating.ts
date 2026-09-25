// §8 derived numbers: seat count, opening, coffee-table clearances, warnings.
import {
  CLEARANCE_MIN,
  OPENING_MIN,
  SEAT_DEPTH_MIN,
  SNUG_SEAT_WIDTH,
  WEDGE_FACE_MIN,
} from './defaults';
import { corners, runIds } from './layout';
import { MAX_PIECE, MIN_SEAT, TABLE_MAX, TABLE_MIN, cushionOf, isSeat } from './pieces';
import type { BuiltPiece, Clearance, Config, Pt, SeatCount, Warning } from './types';

const fmt = (n: number): string => String(Math.round(n * 10) / 10);

/**
 * Straight stretches of seat cushion per run. A stretch is broken by a table,
 * a gap, an arm (at whichever end of its piece it sits) and the run ends.
 */
export function seatStretches(c: Config): number[] {
  const A = c.dims.A;
  const out: number[] = [];
  for (const run of runIds(c.shape)) {
    let acc = 0;
    const flush = () => {
      if (acc > 0) out.push(acc);
      acc = 0;
    };
    for (const p of c.runs[run] ?? []) {
      if (p.kind === 'armless') acc += p.length;
      else if (p.kind === 'oneArm') {
        if (p.arm === 'start') flush();
        acc += cushionOf(p, A);
        if (p.arm === 'end') flush();
      } else flush();
    }
    flush();
  }
  return out;
}

export function formatSeats(comfortable: number, snug: number): string {
  return comfortable === snug ? `Seats ${comfortable}` : `Seats ${comfortable}–${snug}`;
}

/** Each wedge = 1; each stretch = floor(len / seatWidth) .. floor(len / snug). */
export function seatCount(c: Config): SeatCount {
  const wedges = corners(c.shape).length;
  const snugWidth = Math.min(SNUG_SEAT_WIDTH, c.seatWidth);
  let comfortable = wedges;
  let snug = wedges;
  for (const len of seatStretches(c)) {
    comfortable += Math.floor(len / c.seatWidth);
    snug += Math.floor(len / snugWidth);
  }
  return { comfortable, snug, label: formatSeats(comfortable, snug) };
}

/** Inside opening, U only (§8). */
export function opening(c: Config): { width: number; depth: number } | null {
  if (c.shape !== 'U') return null;
  return { width: c.W - 2 * c.D, depth: Math.min(c.L, c.R) - c.D };
}

export const wedgeFace = (C: number, D: number): number => (C - D) * Math.SQRT2;

export function wedgeReadout(C: number, D: number): string {
  return `Wedge ${C} × ${C} · angled face ${wedgeFace(C, D).toFixed(1)}"`;
}

// ---------------------------------------------------------------------------
// Coffee-table clearance: for each side of the table, the distance to the
// nearest sofa piece straight out from that side (exact polygons, so the
// wedge's angled face counts). null = nothing on that side (the open end).

function clip(poly: Pt[], axis: 0 | 1, bound: number, keepLE: boolean): Pt[] {
  const out: Pt[] = [];
  const inside = (p: Pt) => (keepLE ? p[axis] <= bound : p[axis] >= bound);
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  });
  return out;
}

const EPS = 1e-6;

function sideGap(
  sofa: Pt[][],
  slabAxis: 0 | 1,
  slab: [number, number],
  axis: 0 | 1,
  edge: number,
  dir: -1 | 1,
): number | null {
  let best: number | null = null;
  for (const poly of sofa) {
    let p = clip(poly, slabAxis, slab[0] + EPS, false);
    p = clip(p, slabAxis, slab[1] - EPS, true);
    p = clip(p, axis, edge, dir < 0);
    if (p.length === 0) continue;
    const coords = p.map((q) => q[axis]);
    const gap = dir < 0 ? edge - Math.max(...coords) : Math.min(...coords) - edge;
    if (best === null || gap < best) best = gap;
  }
  return best === null ? null : Math.round(best * 100) / 100;
}

export function coffeeClearances(c: Config, pieces: BuiltPiece[]): Clearance[] {
  const sofa = pieces.filter((p) => p.run !== null || p.corner !== null).map((p) => p.polygon);
  return c.loose
    .filter((l) => l.kind === 'coffeeTable')
    .map((t) => {
      const xs: [number, number] = [t.x, t.x + t.w];
      const ys: [number, number] = [t.y, t.y + t.d];
      const back = sideGap(sofa, 0, xs, 1, t.y, -1);
      const front = sideGap(sofa, 0, xs, 1, t.y + t.d, 1);
      const left = sideGap(sofa, 1, ys, 0, t.x, -1);
      const right = sideGap(sofa, 1, ys, 0, t.x + t.w, 1);
      const all = [back, left, right, front].filter((v): v is number => v !== null);
      return { pieceId: t.id, back, left, right, front, min: all.length ? Math.min(...all) : null };
    });
}

// ---------------------------------------------------------------------------
// §8 warnings (yellow, never blocking)

export function collectWarnings(c: Config, C: number, clearances: Clearance[]): Warning[] {
  const w: Warning[] = [];
  const A = c.dims.A;
  for (const run of runIds(c.shape)) {
    for (const p of c.runs[run] ?? []) {
      if (p.kind === 'gap') continue;
      if (p.length > MAX_PIECE) {
        w.push({ code: 'pieceOver108', run, pieceId: p.id, message: `Piece ${p.length}" is over ${MAX_PIECE}"` });
      }
      if (isSeat(p) && cushionOf(p, A) < MIN_SEAT) {
        w.push({ code: 'seatUnder20', run, pieceId: p.id, message: `Seat ${cushionOf(p, A)}" is under ${MIN_SEAT}"` });
      }
      if (p.kind === 'table' && (p.length < TABLE_MIN || p.length > TABLE_MAX)) {
        w.push({ code: 'tableOutOfRange', run, pieceId: p.id, message: `Table ${p.length}" is outside ${TABLE_MIN}–${TABLE_MAX}"` });
      }
    }
  }
  const face = wedgeFace(C, c.D);
  if (face > 0 && face < WEDGE_FACE_MIN) {
    w.push({ code: 'wedgeFaceUnder8', message: `Wedge angled face ${face.toFixed(1)}" is under ${WEDGE_FACE_MIN}"` });
  }
  const o = opening(c);
  if (o && (o.width < OPENING_MIN || o.depth < OPENING_MIN)) {
    w.push({ code: 'openingUnder60', message: `Opening ${fmt(o.width)} × ${fmt(o.depth)} is under ${OPENING_MIN}"` });
  }
  const seatDepth = c.D - c.dims.B;
  if (seatDepth < SEAT_DEPTH_MIN) {
    w.push({ code: 'seatDepthUnder24', message: `Seat depth ${seatDepth}" is under ${SEAT_DEPTH_MIN}"` });
  }
  for (const cl of clearances) {
    if (cl.min !== null && cl.min < CLEARANCE_MIN) {
      w.push({ code: 'coffeeClearanceUnder14', pieceId: cl.pieceId, message: `Coffee table clearance ${fmt(cl.min)}" is under ${CLEARANCE_MIN}"` });
    }
  }
  return w;
}
