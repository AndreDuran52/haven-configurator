// Piece edits: resize, seam drag, add, delete, convert, end cap.
import { ABSORB_FLOOR, MAX_PIECE, defaultLength, half, isSeat } from './pieces';
import { absorb } from './absorb';
import { dissolveGroup, endCapState, openEnd, runSum } from './layout';
import { blockOf, insertPiece, resizeSide, sideRange } from './placement';
import { edit, findPiece } from './ops';
import type { Config, EndCap, Placement, RunEnd, RunId, RunPiece } from './types';

// ---------------------------------------------------------------------------
// Piece edits. Lock ON: the absorber rule keeps each run's total. Lock OFF:
// the run grows/shrinks and W/L/R are re-derived.

export function resizePiece(config: Config, id: string, length: number): Config {
  return edit(config, (d, alloc) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind === 'gap') return false;
    const len = half(length);
    const A = d.dims.A;
    if (!(len > 0) || (isSeat(f.piece) && len - (f.piece.kind === 'oneArm' ? A : 0) < ABSORB_FLOOR)) return false;
    if (f.piece.kind === 'table' && len > MAX_PIECE) return false; // tables can't auto-split
    const delta = len - f.piece.length;
    if (delta === 0) return false;
    const pieces = d.runs[f.run]!;
    dissolveGroup(pieces, f.piece.splitGroup);
    f.piece.length = len;
    return !d.lockOutside || absorb(pieces, { piece: f.index }, -delta, A, alloc, new Set([id]));
  });
}

/**
 * §7 seam handle: the side before the seam grows by dx, the side after shrinks
 * by dx; their total never changes, so the lock is irrelevant. dx snaps to 0.5
 * and clamps so neither side leaves [min(rule, now), max(rule, now)] (seat
 * cushion >= 20, piece <= 108, table 16..40, gap >= 0). A "side" is a lone
 * piece or a whole split group (which stays equal and may re-split/merge);
 * dragging the seam INSIDE a split group dissolves it. Wedge seams are not handles.
 */
export function dragSeam(config: Config, run: RunId, seam: number, dx: number): Config {
  return edit(config, (d) => {
    const pieces = d.runs[run];
    if (!pieces || !Number.isInteger(seam) || seam < 1 || seam > pieces.length - 1) return false;
    const A = d.dims.A;
    const g = pieces[seam - 1]!.splitGroup;
    if (g && g === pieces[seam]!.splitGroup) dissolveGroup(pieces, g);
    const sa = blockOf(pieces, seam - 1);
    const sb = blockOf(pieces, seam);
    const ta = runSum(sa.map((i) => pieces[i]!));
    const tb = runSum(sb.map((i) => pieces[i]!));
    const [loA, hiA] = sideRange(pieces, sa, A);
    const [loB, hiB] = sideRange(pieces, sb, A);
    const lo = Math.max(loA - ta, tb - hiB);
    const hi = Math.min(hiA - ta, tb - loB);
    const step = Math.min(hi, Math.max(lo, half(dx)));
    if (step === 0) return false;
    resizeSide(pieces, sa, ta + step, A);
    resizeSide(pieces, sb, tb - step, A);
    return true;
  });
}

export interface AddOptions {
  /** Footprint along the run (oneArm: including the arm). */
  length?: number;
  /** oneArm: arm side; default = toward the run's open end, else 'end'. */
  arm?: RunEnd;
}

export function addPiece(
  config: Config,
  kind: 'armless' | 'oneArm' | 'table',
  placement: Placement,
  opts: AddOptions = {},
): Config {
  return edit(config, (d, alloc) => {
    const A = d.dims.A;
    const length = half(opts.length ?? defaultLength(kind, A));
    const piece: RunPiece = { id: alloc('p'), kind, length };
    if (kind === 'oneArm') piece.arm = opts.arm ?? openEnd(d.shape, placement.run) ?? 'end';
    if (!(length > 0) || (kind !== 'table' && length - (kind === 'oneArm' ? A : 0) < ABSORB_FLOOR)) return false;
    if (kind === 'table' && length > MAX_PIECE) return false; // tables can't auto-split
    return insertPiece(d, alloc, piece, placement);
  });
}

/**
 * Delete: lock ON gives the freed length to the absorber rule (a partially
 * filled run keeps a gap in place instead); lock OFF shrinks the run.
 */
export function deletePiece(config: Config, id: string): Config {
  return edit(config, (d, alloc) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind === 'gap') return false;
    const pieces = d.runs[f.run]!;
    dissolveGroup(pieces, f.piece.splitGroup);
    pieces.splice(f.index, 1);
    return !d.lockOutside || absorb(pieces, { seam: f.index }, f.piece.length, d.dims.A, alloc);
  });
}

/** armless <-> oneArm. The footprint is unchanged: the arm's 14" moves between cushion and arm. */
export function convertPiece(config: Config, id: string, arm?: RunEnd): Config {
  return edit(config, (d) => {
    const f = findPiece(d, id);
    if (!f || !isSeat(f.piece)) return false;
    dissolveGroup(d.runs[f.run]!, f.piece.splitGroup);
    if (f.piece.kind === 'oneArm') {
      f.piece.kind = 'armless';
      delete f.piece.arm;
      return true;
    }
    if (f.piece.length - d.dims.A < ABSORB_FLOOR) return false;
    f.piece.kind = 'oneArm';
    f.piece.arm = arm ?? openEnd(d.shape, f.run) ?? 'end';
    return true;
  });
}

/** Tap menu: end cap of a run's open end (arm / table in place of the arm / open). */
export function setEndCap(config: Config, run: RunId, cap: EndCap): Config {
  return edit(config, (d, alloc) => {
    const pieces = d.runs[run];
    const open = openEnd(d.shape, run);
    if (!pieces || !open) return false;
    const A = d.dims.A;
    const state = endCapState(pieces, open);
    if (state === cap || state === 'unfilled') return false;
    const endIdx = () => (open === 'end' ? pieces.length - 1 : 0);
    const removeEndTable = (): boolean => {
      const i = endIdx();
      const [t] = pieces.splice(i, 1);
      return !d.lockOutside || absorb(pieces, { seam: i }, t!.length, A, alloc);
    };
    const setArm = (idx: number, on: boolean): boolean => {
      const p = pieces[idx];
      if (!p || !isSeat(p)) return false;
      dissolveGroup(pieces, p.splitGroup);
      if (!on) {
        p.kind = 'armless';
        delete p.arm;
        return true;
      }
      if (p.kind === 'armless' && p.length - A < ABSORB_FLOOR) return false;
      p.kind = 'oneArm';
      p.arm = open;
      return true;
    };
    if (cap === 'arm') {
      if (state === 'open') return setArm(endIdx(), true);
      if (state === 'armTable') return removeEndTable();
      return removeEndTable() && setArm(endIdx(), true); // 'table'
    }
    if (cap === 'open') {
      if (state === 'arm') return setArm(endIdx(), false);
      if (state === 'table') return removeEndTable();
      return removeEndTable() && setArm(endIdx(), false); // 'armTable'
    }
    // cap === 'table'
    if (state === 'armTable') return setArm(open === 'end' ? pieces.length - 2 : 1, false);
    const table: RunPiece = { id: alloc('p'), kind: 'table', length: defaultLength('table', A) };
    return insertPiece(d, alloc, table, { run, at: 'replaceArm' });
  });
}
