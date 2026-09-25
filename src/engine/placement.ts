// Table/piece placement and seam-handle helpers. Works on a DRAFT.
import {
  ABSORB_FLOOR,
  MAX_PIECE,
  MIN_SEAT,
  TABLE_MAX,
  TABLE_MIN,
  cushionOf,
  distribute,
  isSeat,
  splitHalf,
} from './pieces';
import { absorb } from './absorb';
import { dissolveGroup, openEnd, runSum, seat, type Alloc } from './layout';
import type { Config, Placement, RunPiece } from './types';

// ---------------------------------------------------------------------------
// Placement (tables anywhere, §6) — shared by addPiece and moveTable

export function insertPiece(d: Config, alloc: Alloc, piece: RunPiece, placement: Placement): boolean {
  const pieces = d.runs[placement.run];
  if (!pieces) return false;
  const A = d.dims.A;
  const lock = d.lockOutside;
  const place = (at: number): boolean => {
    pieces.splice(at, 0, piece);
    return !lock || absorb(pieces, { piece: at }, -piece.length, A, alloc, new Set([piece.id]));
  };
  if (placement.at === 'seam') {
    const s = placement.seam;
    if (!Number.isInteger(s) || s < 0 || s > pieces.length) return false;
    return place(s);
  }
  if (placement.at === 'replaceArm') {
    const open = openEnd(d.shape, placement.run);
    if (piece.kind !== 'table' || !open) return false;
    const endPiece = pieces[open === 'end' ? pieces.length - 1 : 0];
    if (endPiece?.kind === 'oneArm' && endPiece.arm === open) {
      dissolveGroup(pieces, endPiece.splitGroup);
      endPiece.kind = 'armless';
      delete endPiece.arm;
    }
    return place(open === 'end' ? pieces.length : 0);
  }
  // split: the target's cushion (minus the new piece when locked) is shared
  // equally on both sides; the extra 0.5 goes to the side away from the arm.
  const i = pieces.findIndex((p) => p.id === placement.pieceId);
  const t = pieces[i];
  if (!t || !isSeat(t)) return false;
  dissolveGroup(pieces, t.splitGroup);
  const c = cushionOf(t, A);
  const remaining = lock ? c - piece.length : c;
  if (remaining < 2 * ABSORB_FLOOR) return false;
  let [c1, c2] = splitHalf(remaining);
  if (t.arm === 'start') [c1, c2] = [c2, c1];
  const first = seat(t.id, c1 + (t.arm === 'start' ? A : 0), t.arm === 'start' ? 'start' : null);
  const second = seat(alloc('p'), c2 + (t.arm === 'end' ? A : 0), t.arm === 'end' ? 'end' : null);
  pieces.splice(i, 1, first, piece, second);
  return true;
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

export function resizeSide(pieces: RunPiece[], idx: number[], total: number, A: number): void {
  if (idx.length === 1) {
    pieces[idx[0]!]!.length = total;
    return;
  }
  const arm = idx.map((i) => pieces[i]!).find((p) => p.kind === 'oneArm')?.arm ?? null;
  distribute(total, idx.length, arm, A).forEach((len, k) => (pieces[idx[k]!]!.length = len));
}
