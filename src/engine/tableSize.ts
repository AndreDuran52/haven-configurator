// The table ± (UX Phase 3c, Andre 2026-11-09): a table grows or shrinks from
// its middle. With "Other seats adjust" and a seat on each side, each seat
// gives (or takes) half of the change; with a seat on one side only, that seat
// takes it all; with "Sofa size changes" the sofa grows and the seats stay.
// 16–40″, and never a seat beside it pushed under 23″ (narrowing always works).
// Through the index (not file by file), so the engine stays one chunk when this loads lazily.
import { ABSORB_FLOOR, TABLE_MAX, TABLE_MIN, cushionOf, detach, edit, findPiece, half, noRoom, notAllowed, refuse, seatPair, settle, splitHalf, tableFits, type Config, type EditResult, type Outcome } from './index';

export const TABLE_SEAT_ROOM = 'The seats beside it can’t go under 23″';

export function resizeTable(config: Config, id: string, width: number): EditResult {
  const r = edit(config, (d, alloc): Outcome => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind !== 'table') return notAllowed('Only a table');
    const w = half(width);
    if (!(w >= TABLE_MIN && w <= TABLE_MAX)) return refuse('infeasible', `A table is ${TABLE_MIN}–${TABLE_MAX}″`);
    const delta = w - f.piece.length;
    if (!delta) return null;
    const pieces = d.runs[f.run]!;
    const pair = seatPair(pieces, f.index);
    if (pair && d.lockOutside) {
      // From the middle: half from each side (the extra ½″ of an odd step from the first).
      const [ga, gb] = splitHalf(delta);
      pair[0].length = half(pair[0].length - ga);
      pair[1].length = half(pair[1].length - gb);
      if (cushionOf(pair[0], d.dims.A) < ABSORB_FLOOR || cushionOf(pair[1], d.dims.A) < ABSORB_FLOOR) return noRoom(TABLE_SEAT_ROOM);
      f.piece.length = w;
      return true;
    }
    detach(pieces, f.piece);
    f.piece.length = w;
    return settle(d, f.run, { piece: f.index }, -delta, alloc, new Set([id])) || noRoom(TABLE_SEAT_ROOM);
  });
  if (r.rejected || r.config === config || tableFits(config, r.config)) return r;
  return { config, rejected: refuse('noRoom', TABLE_SEAT_ROOM) };
}
