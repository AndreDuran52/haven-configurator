// Piece edits (§5.3): resize, seam drag, add, delete, convert, end cap, fill.
// Lock ON: the absorber rule keeps each run's total. Lock OFF: the run grows or
// shrinks and W/L/R are re-derived. Rule breaks (G11, cushion floor) are
// refused by edit() after the op body runs.
import { ABSORB_FLOOR, MAX_PIECE, defaultLength, half, isSeat } from './pieces';
import { settle } from './absorb';
import { detach, endCapState, endIndex, openEnd, runSum } from './layout';
import { blockOf, insertPiece, removeTable, resizeSide, setArm, sideRange } from './placement';
import { edit, findPiece, noRoom, notAllowed, type Outcome } from './edit';
import { moveTableIn } from './tableOps';
import type { Config, EditResult, EndCap, Placement, RunEnd, RunId, RunPiece } from './types';

export function resizePiece(config: Config, id: string, length: number): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind === 'gap') return notAllowed('Only seats and tables can be resized');
    const len = half(length);
    const A = d.dims.A;
    if (!(len > 0)) return notAllowed('Length must be positive');
    if (isSeat(f.piece) && len - (f.piece.kind === 'oneArm' ? A : 0) < ABSORB_FLOOR) {
      return noRoom(`A seat cushion can't be under ${ABSORB_FLOOR}″`);
    }
    if (f.piece.kind === 'table' && len > MAX_PIECE) return notAllowed(`Tables can't be over ${MAX_PIECE}″`);
    const delta = len - f.piece.length;
    if (delta === 0) return null;
    detach(d.runs[f.run]!, f.piece);
    f.piece.length = len;
    return settle(d, f.run, { piece: f.index }, -delta, alloc, new Set([id])) || noRoom();
  });
}

/**
 * §7 seam handle: the side before the seam grows by dx, the side after shrinks
 * by dx; their total never changes, so the lock is irrelevant. dx snaps to 0.5
 * and clamps so neither side leaves [min(rule, now), max(rule, now)]. A "side"
 * is a lone piece or a whole split group (which stays equal and may re-split);
 * dragging the seam INSIDE a split group dissolves it. Only seat|seat,
 * seat|table and seat|gap seams have handles; wedge seams use the slider.
 * Always call it with the GESTURE-START config and the CUMULATIVE dx.
 */
export function dragSeam(config: Config, run: RunId, seam: number, dx: number): EditResult {
  return edit(config, (d): Outcome => {
    const pieces = d.runs[run];
    if (!pieces || !Number.isInteger(seam) || seam < 1 || seam > pieces.length - 1) return notAllowed('No handle on this seam');
    const a = pieces[seam - 1]!;
    const b = pieces[seam]!;
    if (!isSeat(a) && !isSeat(b)) return notAllowed('No handle on this seam');
    const A = d.dims.A;
    if (a.splitGroup && a.splitGroup === b.splitGroup) detach(pieces, a);
    const sa = blockOf(pieces, seam - 1);
    const sb = blockOf(pieces, seam);
    const ta = runSum(sa.map((i) => pieces[i]!));
    const tb = runSum(sb.map((i) => pieces[i]!));
    const [loA, hiA] = sideRange(pieces, sa, A);
    const [loB, hiB] = sideRange(pieces, sb, A);
    const lo = Math.max(loA - ta, tb - hiB);
    const hi = Math.min(hiA - ta, tb - loB);
    const step = Math.min(hi, Math.max(lo, half(dx)));
    if (step === 0) return null;
    resizeSide(pieces, sa, ta + step);
    resizeSide(pieces, sb, tb - step);
    return true;
  });
}

export interface AddOptions {
  /** Footprint along the run (oneArm: including the arm). */
  length?: number;
  /** oneArm: arm side; default = toward the run's open end. */
  arm?: RunEnd;
}

/** §5.4 defaults: armless 36, one-arm 50 (36 + 14), table 32. */
export function addPiece(
  config: Config,
  kind: 'armless' | 'oneArm' | 'table',
  placement: Placement,
  opts: AddOptions = {},
): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const A = d.dims.A;
    const length = half(opts.length ?? defaultLength(kind, A));
    const piece: RunPiece = { id: alloc('p'), kind, length };
    if (kind === 'oneArm') piece.arm = opts.arm ?? openEnd(d.shape, placement.run) ?? 'end';
    if (!(length > 0)) return notAllowed('Length must be positive');
    if (kind !== 'table' && length - (kind === 'oneArm' ? A : 0) < ABSORB_FLOOR) {
      return noRoom(`A seat cushion can't be under ${ABSORB_FLOOR}″`);
    }
    if (kind === 'table' && length > MAX_PIECE) return notAllowed(`Tables can't be over ${MAX_PIECE}″`);
    return insertPiece(d, alloc, piece, placement);
  });
}

/**
 * Delete: lock ON gives the freed length to the absorber rule (a run with gaps
 * keeps a gap in place instead); lock OFF shrinks the run. Deleting a table
 * merges the seat it split (G1).
 */
export function deletePiece(config: Config, id: string): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const f = findPiece(d, id);
    if (!f) return notAllowed(id.startsWith('wedge:') ? 'Wedges come with the shape' : 'No such piece');
    if (f.piece.kind === 'gap') return notAllowed('Nothing to delete');
    const pieces = d.runs[f.run]!;
    if (f.piece.kind === 'table') return removeTable(d, f.run, f.index, alloc);
    if (!d.lockOutside && f.run !== 'back' && pieces.every((p) => p === f.piece || p.kind === 'gap')) {
      return notAllowed('Switch to an L instead');
    }
    detach(pieces, f.piece);
    pieces.splice(f.index, 1);
    return settle(d, f.run, { seam: f.index }, f.piece.length, alloc) || noRoom();
  });
}

/**
 * armless <-> oneArm (G5: lock ON keeps the footprint, lock OFF the cushion).
 * An arm is allowed only on the last seat before the open end (G11).
 */
export function convertPiece(config: Config, id: string, arm?: RunEnd): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const f = findPiece(d, id);
    if (!f || !isSeat(f.piece)) return notAllowed('Only seats can be converted');
    const open = openEnd(d.shape, f.run);
    if (f.piece.kind === 'armless' && arm && arm !== open) return notAllowed('Arms go at the open end');
    return setArm(d, f.run, f.index, f.piece.kind === 'armless', alloc);
  });
}

/** Tap menu: end cap of a run's open end (arm / table in place of the arm / open). */
export function setEndCap(config: Config, run: RunId, cap: EndCap): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const pieces = d.runs[run];
    const open = openEnd(d.shape, run);
    if (!pieces || !open) return notAllowed('This run has no open end');
    const state = endCapState(pieces, open);
    if (state === 'unfilled') return notAllowed('Fill the gap first');
    if (state === cap) return null;
    const removeEndTable = () => removeTable(d, run, endIndex(pieces, open), alloc);
    const arm = (on: boolean) => setArm(d, run, endIndex(pieces, open), on, alloc);
    const then = (a: Outcome, b: () => Outcome): Outcome => (a === true || a === null ? b() : a);
    if (cap === 'arm') {
      if (state === 'open') return arm(true);
      if (state === 'armTable') return removeEndTable();
      return then(removeEndTable(), () => arm(true)); // 'table'
    }
    if (cap === 'open') {
      if (state === 'arm') return arm(false);
      if (state === 'table') return removeEndTable();
      return then(removeEndTable(), () => arm(false)); // 'armTable'
    }
    // cap === 'table'
    if (state === 'armTable') return setArm(d, run, open === 'end' ? pieces.length - 2 : 1, false, alloc);
    const table: RunPiece = { id: alloc('p'), kind: 'table', length: defaultLength('table', d.dims.A) };
    return insertPiece(d, alloc, table, { run, at: 'replaceArm' });
  });
}

/**
 * §7 reorder: seats and gaps move within their run (lengths untouched). Tables
 * move with moveTable (same-run seam); wedges are fixed; one-arm pieces stay at
 * their arm end (G11 refuses anything else).
 */
export function reorderPiece(config: Config, id: string, toIndex: number): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const f = findPiece(d, id);
    if (!f) return notAllowed(id.startsWith('wedge:') ? 'Wedges are fixed' : 'No such piece');
    if (f.piece.kind === 'table') return moveTableIn(d, alloc, id, { run: f.run, at: 'seam', seam: toIndex });
    const pieces = d.runs[f.run]!;
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > pieces.length - 1) return notAllowed('No such position');
    if (toIndex === f.index) return null;
    detach(pieces, f.piece);
    pieces.splice(f.index, 1);
    pieces.splice(toIndex, 0, f.piece);
    return true;
  });
}

/**
 * Blank mode "Fill": a gap becomes a seat or a table of the same length. A
 * one-arm fill gets its arm at the open end if the gap touches it and the
 * cushion floor allows; otherwise it is armless.
 */
export function fillGap(config: Config, gapId: string, kind: 'armless' | 'oneArm' | 'table'): EditResult {
  return edit(config, (d): Outcome => {
    const f = findPiece(d, gapId);
    if (!f || f.piece.kind !== 'gap') return notAllowed('No such gap');
    const p = f.piece;
    if (kind === 'table') {
      if (p.length > MAX_PIECE) return notAllowed(`Tables can't be over ${MAX_PIECE}″`);
      p.kind = 'table';
      return true;
    }
    if (p.length < ABSORB_FLOOR) return noRoom(`Too small for a seat (under ${ABSORB_FLOOR}″)`);
    const pieces = d.runs[f.run]!;
    const open = openEnd(d.shape, f.run);
    const touches = open !== null && f.index === endIndex(pieces, open);
    if (kind === 'oneArm' && touches && p.length - d.dims.A >= ABSORB_FLOOR) {
      p.kind = 'oneArm';
      p.arm = open;
    } else {
      p.kind = 'armless';
    }
    return true;
  });
}
