// Rebalancing: the absorber rule. Works on a DRAFT (a clone owned by one op),
// so it may mutate its arguments.
import { ABSORB_FLOOR, cushionOf, distribute, isSeat, splitHalf } from './pieces';
import { available, runEnds, runIds, type Alloc } from './layout';
import type { Config, RunEnd, RunPiece } from './types';

// ---------------------------------------------------------------------------
// Rebalancing: the absorber rule

/** Where an edit happened: a seam (0..n) or a piece index (the edited piece itself). */
export type Anchor = { seam: number } | { piece: number };

interface Unit {
  kind: 'gap' | 'seat';
  idx: number[];
  /** Gap: its length. Seat: total cushion of the unit. */
  size: number;
  dist: number;
  arm: RunEnd | null;
}

/** Piece-count distance: pieces touching the anchor are 0. */
function distance(j: number, a: Anchor): number {
  if ('seam' in a) return j < a.seam ? a.seam - 1 - j : j - a.seam;
  return Math.abs(j - a.piece) - 1;
}

function collectUnits(pieces: RunPiece[], A: number, anchor: Anchor, exclude: Set<string>) {
  const gaps: Unit[] = [];
  const seats: Unit[] = [];
  for (let i = 0; i < pieces.length; ) {
    const p = pieces[i]!;
    const idx = [i];
    if (isSeat(p) && p.splitGroup) {
      while (pieces[i + idx.length]?.splitGroup === p.splitGroup) idx.push(i + idx.length);
    }
    i += idx.length;
    if (p.kind === 'table' || idx.some((j) => exclude.has(pieces[j]!.id))) continue;
    const dist = Math.min(...idx.map((j) => distance(j, anchor)));
    if (p.kind === 'gap') {
      gaps.push({ kind: 'gap', idx, size: p.length, dist, arm: null });
    } else {
      const members = idx.map((j) => pieces[j]!);
      const arm = members.find((q) => q.kind === 'oneArm')?.arm ?? null;
      const size = members.reduce((s, q) => s + cushionOf(q, A), 0);
      seats.push({ kind: 'seat', idx, size, dist, arm });
    }
  }
  gaps.sort((a, b) => a.dist - b.dist || a.idx[0]! - b.idx[0]!);
  // Tie-break: nearest, then the LARGER cushion (more room), then the lower index.
  seats.sort((a, b) => a.dist - b.dist || b.size - a.size || a.idx[0]! - b.idx[0]!);
  return { gaps, seats };
}

function applyToUnit(pieces: RunPiece[], u: Unit, d: number, A: number): void {
  if (u.idx.length === 1) {
    pieces[u.idx[0]!]!.length += d;
    return;
  }
  const total = u.idx.reduce((s, j) => s + pieces[j]!.length, 0) + d;
  const lengths = distribute(total, u.idx.length, u.arm, A);
  u.idx.forEach((j, k) => (pieces[j]!.length = lengths[k]!));
}

/**
 * Make the run absorb `delta` inches at `anchor` (delta > 0: space was freed;
 * delta < 0: space is needed). Mutates `pieces`. Returns false if impossible.
 *
 * Freed space: if the run has any gap (a partially filled run) it becomes a
 * gap at the anchor, so placed pieces stay put; else the nearest seat unit
 * grows; else a gap is created at the anchor.
 * Needed space: nearest gaps first (down to 0), then seat units by
 * (distance, larger cushion, lower index) down to ABSORB_FLOOR each, cascading.
 * Tables never absorb. A split group absorbs as one unit.
 */
export function absorb(
  pieces: RunPiece[],
  anchor: Anchor,
  delta: number,
  A: number,
  alloc: Alloc,
  exclude: Set<string> = new Set(),
): boolean {
  if (delta === 0) return true;
  const { gaps, seats } = collectUnits(pieces, A, anchor, exclude);
  if (delta > 0) {
    const hasGap = pieces.some((p) => p.kind === 'gap');
    if (!hasGap && seats[0]) {
      applyToUnit(pieces, seats[0], delta, A);
      return true;
    }
    const at = 'seam' in anchor ? anchor.seam : anchor.piece + 1;
    pieces.splice(at, 0, { id: alloc('p'), kind: 'gap', length: delta });
    return true;
  }
  let need = -delta;
  for (const u of [...gaps, ...seats]) {
    const cap = u.kind === 'gap' ? u.size : u.size - ABSORB_FLOOR;
    if (cap <= 0) continue;
    const take = Math.min(cap, need);
    applyToUnit(pieces, u, -take, A);
    need -= take;
    if (need === 0) return true;
  }
  return false;
}

/**
 * Absorb a change at each end of a run (measurement / wedge edits). Growth is
 * applied before shrinkage so a net-zero change can never fail.
 */
export function rebalanceEnds(
  pieces: RunPiece[],
  startDelta: number,
  endDelta: number,
  A: number,
  alloc: Alloc,
): boolean {
  const steps: [RunEnd, number][] = [
    ['start', startDelta],
    ['end', endDelta],
  ];
  steps.sort((a, b) => b[1] - a[1]);
  for (const [end, delta] of steps) {
    const anchor = end === 'start' ? { seam: 0 } : { seam: pieces.length };
    if (!absorb(pieces, anchor, delta, A, alloc)) return false;
  }
  return true;
}

/**
 * Re-flow every run after W/L/R/D/C changed. A wedge end absorbs -dC; an open
 * end absorbs its run's outside change; a U back (wedge at both ends) splits
 * dW in half, the start end taking the extra 0.5.
 */
export function reshapeRuns(d: Config, alloc: Alloc, dC: number, dW: number, dL: number, dR: number): boolean {
  for (const run of runIds(d.shape)) {
    if (available(d, run) < 0) return false;
    const ends = runEnds(d.shape, run);
    const dOuter = run === 'back' ? dW : run === 'left' ? dL : dR;
    let s = ends.start === 'wedge' ? -dC : dOuter;
    let e = ends.end === 'wedge' ? -dC : dOuter;
    if (ends.start === 'wedge' && ends.end === 'wedge') {
      const [a, b] = splitHalf(dOuter);
      s += a;
      e += b;
    }
    if (!rebalanceEnds(d.runs[run]!, s, e, d.dims.A, alloc)) return false;
  }
  return true;
}
