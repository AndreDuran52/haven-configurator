// Balance seats around a table (Andre, 2026-11-06). A table between two seats
// keeps them equal: a new table dropped into a seat starts at 20″ (TABLE_MID),
// resizing it takes the change from both seats, "Even seats" re-shares their
// cushions, and an arm-width change keeps an even pair even. The extra 0.5″ of
// an odd total goes to the side away from the arm (as G1).
import { ABSORB_FLOOR, cushionOf, isSeat, splitHalf } from './pieces';
import { edit, findPiece, noRoom, notAllowed, type Outcome } from './edit';
import type { Config, EditResult, RunPiece } from './types';

/** A new table dropped into the middle of a seat starts at this width. */
export const TABLE_MID = 20;

/** The seats either side of the table at index i, or null. */
export function seatPair(pieces: RunPiece[], i: number): [RunPiece, RunPiece] | null {
  const a = pieces[i - 1];
  const b = pieces[i + 1];
  return pieces[i]?.kind === 'table' && a && b && isSeat(a) && isSeat(b) ? [a, b] : null;
}

/** The two seat cushions either side of table `id`, or null. */
export function tableSeats(config: Config, id: string): [number, number] | null {
  const f = findPiece(config, id);
  if (!f) return null;
  const pair = seatPair(config.runs[f.run]!, f.index);
  return pair ? [cushionOf(pair[0], config.dims.A), cushionOf(pair[1], config.dims.A)] : null;
}

/** Share `total` cushion equally between a and b (extra 0.5 away from the arm). False if a side drops under the floor. */
export function sharePair(a: RunPiece, b: RunPiece, total: number, A: number): boolean {
  let [ca, cb] = splitHalf(total);
  // splitHalf gives the first half the extra 0.5: that must be the side away from the arm.
  if (a.kind === 'oneArm' && b.kind !== 'oneArm') [ca, cb] = [cb, ca];
  if (ca < ABSORB_FLOOR || cb < ABSORB_FLOOR) return false;
  a.length = ca + (a.kind === 'oneArm' ? A : 0);
  b.length = cb + (b.kind === 'oneArm' ? A : 0);
  return true;
}

/** True when the pair's cushions differ by at most 0.5″. */
export const isEven = (a: RunPiece, b: RunPiece, A: number): boolean => Math.abs(cushionOf(a, A) - cushionOf(b, A)) <= 0.5;

/** Even seats: the seats either side of table `id` share their cushions equally (run total unchanged). */
export function evenTableSeats(config: Config, id: string): EditResult {
  return edit(config, (d): Outcome => {
    const f = findPiece(d, id);
    const pair = f && seatPair(d.runs[f.run]!, f.index);
    if (!pair) return notAllowed('This table needs a seat on each side');
    const A = d.dims.A;
    const [a, b] = pair;
    const before = [a.length, b.length];
    if (!sharePair(a, b, cushionOf(a, A) + cushionOf(b, A), A)) return noRoom();
    return a.length === before[0] && b.length === before[1] ? null : true;
  });
}

/**
 * Resize a table between two seats (lock on): both seats give or take the
 * change, staying equal. 'fallback' when the table has no seat pair or the
 * lock is off (the caller uses the absorber rule).
 */
export function resizeBetweenSeats(d: Config, pieces: RunPiece[], i: number, len: number): Outcome | 'fallback' {
  const pair = seatPair(pieces, i);
  if (!pair || !d.lockOutside) return 'fallback';
  const A = d.dims.A;
  const total = cushionOf(pair[0], A) + cushionOf(pair[1], A) - (len - pieces[i]!.length);
  if (!sharePair(pair[0], pair[1], total, A)) return noRoom(`The seats can't go under ${ABSORB_FLOOR}″`);
  pieces[i]!.length = len;
  return true;
}

/** Ids of tables whose two seats are even now (kept even through an arm-width change). */
export function evenPairs(d: Config): string[] {
  const out: string[] = [];
  for (const pieces of Object.values(d.runs)) {
    pieces!.forEach((p, i) => {
      const pair = seatPair(pieces!, i);
      if (pair && isEven(pair[0], pair[1], d.dims.A)) out.push(p.id);
    });
  }
  return out;
}

/** Re-even the pairs around these tables (after an edit moved their seats). */
export function reEven(d: Config, tables: string[]): boolean {
  for (const id of tables) {
    const f = findPiece(d, id);
    const pair = f && seatPair(d.runs[f.run]!, f.index);
    if (pair && !sharePair(pair[0], pair[1], cushionOf(pair[0], d.dims.A) + cushionOf(pair[1], d.dims.A), d.dims.A)) return false;
  }
  return true;
}
