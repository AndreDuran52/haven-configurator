// Placement (tables anywhere, §6), G1 table removal with merge-back, G5 arm
// changes and the seam-handle helpers. Works on a DRAFT.
import {
  MAX_PIECE,
  MIN_SEAT,
  SPLIT_MIN_CUSHION,
  TABLE_MAX,
  TABLE_MIN,
  cushionOf,
  distribute,
  isSeat,
  splitHalf,
} from './pieces';
import { settle, type Anchor } from './absorb';
import { clearJoin, detach, endCapState, endIndex, openEnd, runSum, seat, type Alloc } from './layout';
import { noRoom, notAllowed, type Outcome } from './edit';
import { ARM_MESSAGE, armInvariantOk } from './rules';
import type { Config, Placement, RunId, RunPiece } from './types';

/**
 * G5: add or remove the arm of the seat at `idx`. Lock ON keeps the footprint
 * (the cushion changes by 14); lock OFF keeps the cushion (the run changes by 14).
 */
export function setArm(d: Config, run: RunId, idx: number, on: boolean, alloc: Alloc): Outcome {
  const pieces = d.runs[run]!;
  const p = pieces[idx];
  const open = openEnd(d.shape, run);
  if (!p || !isSeat(p)) return notAllowed('Only a seat can carry an arm');
  if ((p.kind === 'oneArm') === on) return null;
  if (on && !open) return notAllowed('Arms go at an open end');
  detach(pieces, p);
  const A = d.dims.A;
  if (on) {
    p.kind = 'oneArm';
    p.arm = open!;
  } else {
    p.kind = 'armless';
    delete p.arm;
  }
  if (d.lockOutside) return true;
  p.length += on ? A : -A;
  return settle(d, run, { piece: idx }, on ? -A : A, alloc, new Set([p.id])) ? true : noRoom();
}

/**
 * Take the table at `index` out of its run WITHOUT settling the freed width.
 * G1: if it sat between its two tagged halves, they merge back into one seat
 * (the split target's id, its arm, the sum of both footprints) first.
 * Returns the anchor where the freed width should be absorbed.
 */
export function takeTable(pieces: RunPiece[], index: number): { table: RunPiece; anchor: Anchor; merged: boolean } {
  const [table] = pieces.splice(index, 1);
  const a = pieces[index - 1];
  const b = pieces[index];
  if (a && b && a.joinedBy === table!.id && b.joinedBy === table!.id) {
    const arm = a.kind === 'oneArm' ? a.arm! : b.kind === 'oneArm' ? b.arm! : null;
    pieces.splice(index - 1, 2, seat(a.id, a.length + b.length, arm));
    return { table: table!, anchor: { piece: index - 1 }, merged: true };
  }
  return { table: table!, anchor: { seam: index }, merged: false };
}

/** Remove a table and let its run absorb the width (lock-aware). */
export function removeTable(d: Config, run: RunId, index: number, alloc: Alloc): Outcome {
  const pieces = d.runs[run]!;
  const { table, anchor } = takeTable(pieces, index);
  return settle(d, run, anchor, table.length, alloc) ? true : noRoom();
}

export function insertPiece(d: Config, alloc: Alloc, piece: RunPiece, placement: Placement): Outcome {
  const run = placement.run;
  const pieces = d.runs[run];
  if (!pieces) return notAllowed(`This shape has no ${run} run`);
  const exclude = new Set([piece.id]);
  const place = (at: number): Outcome => {
    pieces.splice(at, 0, piece);
    // G11 before room: an arm in the wrong place is refused as such.
    if (!armInvariantOk(pieces, openEnd(d.shape, run))) return notAllowed(ARM_MESSAGE);
    return settle(d, run, { piece: at }, -piece.length, alloc, exclude) ? true : noRoom();
  };
  if (placement.at === 'seam') {
    const s = placement.seam;
    if (!Number.isInteger(s) || s < 0 || s > pieces.length) return notAllowed('No such seam');
    return place(s);
  }
  if (placement.at === 'replaceArm') {
    const open = openEnd(d.shape, run);
    if (piece.kind !== 'table' || !open) return notAllowed('Only a table can replace an arm, at an open end');
    const state = endCapState(pieces, open);
    if (state === 'table' || state === 'armTable') return notAllowed('This end already has a table');
    if (state === 'arm') {
      const r = setArm(d, run, endIndex(pieces, open), false, alloc);
      if (r !== true) return r;
    }
    return place(open === 'end' ? pieces.length : 0);
  }
  // split: the target's cushion (minus the table when locked) is shared equally
  // on both sides; the extra 0.5 goes to the side away from the arm.
  const i = pieces.findIndex((p) => p.id === placement.pieceId);
  const t = pieces[i];
  if (!t || !isSeat(t)) return notAllowed('A table can only split a seat');
  if (piece.kind !== 'table') return notAllowed('Only a table can split a seat');
  detach(pieces, t);
  const A = d.dims.A;
  const c = cushionOf(t, A);
  const remaining = d.lockOutside ? c - piece.length : c;
  if (remaining < SPLIT_MIN_CUSHION) return noRoom(`Not enough seat to split (needs ${SPLIT_MIN_CUSHION}″ of cushion left)`);
  let [c1, c2] = splitHalf(remaining);
  if (t.arm === 'start') [c1, c2] = [c2, c1];
  const first = seat(t.id, c1 + (t.arm === 'start' ? A : 0), t.arm === 'start' ? 'start' : null);
  const second = seat(alloc('p'), c2 + (t.arm === 'end' ? A : 0), t.arm === 'end' ? 'end' : null);
  first.joinedBy = piece.id;
  second.joinedBy = piece.id;
  pieces.splice(i, 1, first, piece, second);
  if (d.lockOutside) return true;
  return settle(d, run, { piece: i + 1 }, -piece.length, alloc, exclude) ? true : noRoom();
}

// ---------------------------------------------------------------------------
// Seam handles (§7). A drag never creates a new violation and never jumps:
// each side stays in [min(rule, now), max(rule, now)].

export function dragRange(p: RunPiece, A: number): [number, number] {
  if (p.kind === 'gap') return [0, Infinity];
  if (p.kind === 'table') return [Math.min(p.length, TABLE_MIN), Math.max(p.length, TABLE_MAX)];
  const arm = p.kind === 'oneArm' ? A : 0;
  return [Math.min(p.length, MIN_SEAT + arm), Math.max(p.length, MAX_PIECE)];
}

/** Indices of the contiguous split-group block containing piece i (just [i] if none). */
export function blockOf(pieces: RunPiece[], i: number): number[] {
  const g = pieces[i]?.splitGroup;
  if (!g) return [i];
  let s = i;
  let e = i;
  while (pieces[s - 1]?.splitGroup === g) s--;
  while (pieces[e + 1]?.splitGroup === g) e++;
  return Array.from({ length: e - s + 1 }, (_, k) => s + k);
}

/** Drag range of one side: a lone piece, or a split group (no upper bound: it re-splits). */
export function sideRange(pieces: RunPiece[], idx: number[], A: number): [number, number] {
  if (idx.length === 1) return dragRange(pieces[idx[0]!]!, A);
  const members = idx.map((i) => pieces[i]!);
  const arm = members.some((p) => p.kind === 'oneArm') ? A : 0;
  const total = runSum(members);
  return [Math.min(total, MIN_SEAT + arm), Infinity];
}

export function resizeSide(pieces: RunPiece[], idx: number[], total: number): void {
  if (idx.length === 1) {
    const p = pieces[idx[0]!]!;
    clearJoin(pieces, p.joinedBy);
    p.length = total;
    return;
  }
  const arm = idx.map((i) => pieces[i]!).find((p) => p.kind === 'oneArm')?.arm ?? null;
  distribute(total, idx.length, arm).forEach((len, k) => (pieces[idx[k]!]!.length = len));
}
