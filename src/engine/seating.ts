// §8 derived numbers: seat count, opening, coffee-table clearances, warnings.
import { CLEARANCE_MIN, OPENING_MIN, SEAT_DEPTH_MIN, WEDGE_FACE_MIN } from './defaults';
import { corners, runIds } from './layout';
import { MAX_PIECE, MIN_SEAT, TABLE_MAX, TABLE_MIN, cushionOf, isSeat } from './pieces';
import type { Clearance, Config, SeatCount, Warning } from './types';

const fmt = (n: number): string => String(Math.round(n * 10) / 10);

/**
 * Straight stretches of seat cushion per run. A stretch is broken by a table,
 * a gap, an arm (at whichever end of its piece it sits) and the run ends
 * (wedges); piece and split seams do not break it.
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

/** Each wedge = 1; each stretch = floor(len / seatWidth) .. floor(len / min(snugWidth, seatWidth)) (G8). */
export function seatCount(c: Config): SeatCount {
  const wedges = corners(c.shape).length;
  const snugWidth = Math.min(c.snugWidth, c.seatWidth);
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
// §8 warnings (yellow, never blocking)

export function collectWarnings(c: Config, C: number, clearances: Clearance[]): Warning[] {
  const w: Warning[] = [];
  const A = c.dims.A;
  for (const run of runIds(c.shape)) {
    for (const p of c.runs[run] ?? []) {
      if (p.kind === 'gap') continue;
      if (p.length > MAX_PIECE) {
        w.push({ code: 'pieceOver108', run, pieceId: p.id, message: `Piece ${fmt(p.length)}″ (over ${MAX_PIECE})` });
      }
      if (isSeat(p) && cushionOf(p, A) < MIN_SEAT) {
        w.push({ code: 'seatUnder20', run, pieceId: p.id, message: `Seat ${fmt(cushionOf(p, A))}″ (under ${MIN_SEAT})` });
      }
      if (p.kind === 'table' && (p.length < TABLE_MIN || p.length > TABLE_MAX)) {
        w.push({ code: 'tableOutOfRange', run, pieceId: p.id, message: `Table ${fmt(p.length)}″ (outside ${TABLE_MIN}–${TABLE_MAX})` });
      }
    }
  }
  const face = wedgeFace(C, c.D);
  if (face > 0 && face < WEDGE_FACE_MIN) {
    w.push({ code: 'wedgeFaceUnder8', message: `Wedge angled face ${face.toFixed(1)}″ (under ${WEDGE_FACE_MIN})` });
  }
  const o = opening(c);
  if (o && (o.width < OPENING_MIN || o.depth < OPENING_MIN)) {
    const parts = [o.width < OPENING_MIN ? `${fmt(o.width)}″ wide` : '', o.depth < OPENING_MIN ? `${fmt(o.depth)}″ deep` : ''];
    w.push({ code: 'openingUnder60', message: `Opening ${parts.filter(Boolean).join(', ')} (under ${OPENING_MIN})` });
  }
  const seatDepth = c.D - c.dims.B;
  if (seatDepth < SEAT_DEPTH_MIN) {
    w.push({ code: 'seatDepthUnder24', message: `Seat depth ${fmt(seatDepth)}″ (under ${SEAT_DEPTH_MIN})` });
  }
  for (const cl of clearances) {
    if (cl.overlap) {
      w.push({ code: 'coffeeOverlap', pieceId: cl.pieceId, message: 'Coffee table overlaps the sofa' });
    } else if (cl.min !== null && cl.min < CLEARANCE_MIN) {
      w.push({
        code: 'coffeeClearanceUnder14',
        pieceId: cl.pieceId,
        message: `Coffee table clearance ${fmt(cl.min)}″ (under ${CLEARANCE_MIN})`,
      });
    }
  }
  return w;
}
