// Rebalancing: the absorber rule (§5.4 "Absorption"). Works on a DRAFT (a clone
// owned by one op), so it may mutate its arguments. Arithmetic is in integer
// half-inches (G10).
import { ABSORB_FLOOR, cushionOf, distribute, isSeat, splitHalf, toH, toIn } from './pieces';
import { available, openEnd, runEnds, runIds, type Alloc } from './layout';
import type { Config, RunEnd, RunId, RunPiece } from './types';

/** Where an edit happened: a seam (0..n) or a piece index (the edited piece itself). */
export type Anchor = { seam: number } | { piece: number };

/**
 * 'piece': a piece edit. Freed space in a run that has gaps becomes a gap at the anchor.
 * 'measure': a measurement / D / wedge change. Freed space grows the nearest existing gap.
 */
export type AbsorbMode = 'piece' | 'measure';

export interface AbsorbOptions {
  mode?: AbsorbMode;
  /** Pieces that never absorb (the edited piece). */
  exclude?: Set<string>;
  /** The run's open end, so a new gap never lands between an arm and its open end (G11). */
  open?: RunEnd | null;
}

interface Unit {
  kind: 'gap' | 'seat';
  idx: number[];
  /** Gap: its length. Seat: total cushion of the unit. In half-inches. */
  size: number;
  dist: number;
  arm: RunEnd | null;
}

/** Piece-count distance: pieces touching the anchor are 0 (the anchor piece itself is -1). */
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
      gaps.push({ kind: 'gap', idx, size: toH(p.length), dist, arm: null });
    } else {
      const members = idx.map((j) => pieces[j]!);
      const arm = members.find((q) => q.kind === 'oneArm')?.arm ?? null;
      const size = members.reduce((s, q) => s + toH(cushionOf(q, A)), 0);
      seats.push({ kind: 'seat', idx, size, dist, arm });
    }
  }
  gaps.sort((a, b) => a.dist - b.dist || a.idx[0]! - b.idx[0]!);
  // Tie-break: nearest, then the LARGER cushion (more room), then the lower index.
  seats.sort((a, b) => a.dist - b.dist || b.size - a.size || a.idx[0]! - b.idx[0]!);
  return { gaps, seats };
}

/** Change a unit by d half-inches; a split group stays equal (G9). */
function applyToUnit(pieces: RunPiece[], u: Unit, d: number): void {
  if (u.idx.length === 1) {
    const p = pieces[u.idx[0]!]!;
    p.length = toIn(toH(p.length) + d);
    return;
  }
  const total = u.idx.reduce((s, j) => s + toH(pieces[j]!.length), 0) + d;
  const lengths = distribute(toIn(total), u.idx.length, u.arm);
  u.idx.forEach((j, k) => (pieces[j]!.length = lengths[k]!));
}

/**
 * Seam where a new gap goes. A gap may never sit between a one-arm piece and
 * the open end it faces (G11), so such a gap moves to the arm piece's inner side.
 */
export function gapSeam(pieces: RunPiece[], at: number, open: RunEnd | null | undefined): number {
  if (!open) return at;
  const k = pieces.findIndex((p) => p.kind === 'oneArm' && p.arm === open);
  if (k < 0) return at;
  if (open === 'end' && at > k) return k;
  if (open === 'start' && at <= k) return k + 1;
  return at;
}

function insertGap(pieces: RunPiece[], at: number, length: number, open: RunEnd | null | undefined, alloc: Alloc) {
  pieces.splice(gapSeam(pieces, at, open), 0, { id: alloc('p'), kind: 'gap', length });
}

/**
 * Make the run absorb `delta` inches at `anchor` (delta > 0: space was freed;
 * delta < 0: space is needed). Mutates `pieces`. Returns false if impossible.
 *
 * Freed: a run with gaps keeps placed pieces still (piece edit: a new gap at the
 * anchor; measurement: the nearest gap grows); otherwise the nearest seat unit
 * grows; with no seat at all a gap is created.
 * Needed: nearest gaps first (down to 0), then seat units by (distance, larger
 * cushion, lower index) down to the 6" cushion floor each, cascading.
 * Tables never absorb. A split group absorbs as one unit.
 */
export function absorb(
  pieces: RunPiece[],
  anchor: Anchor,
  delta: number,
  A: number,
  alloc: Alloc,
  opts: AbsorbOptions = {},
): boolean {
  const d = toH(delta);
  if (d === 0) return true;
  const { gaps, seats } = collectUnits(pieces, A, anchor, opts.exclude ?? new Set());
  const at = 'seam' in anchor ? anchor.seam : anchor.piece + 1;
  if (d > 0) {
    if (pieces.some((p) => p.kind === 'gap')) {
      if (opts.mode === 'measure' && gaps[0]) applyToUnit(pieces, gaps[0], d);
      else insertGap(pieces, at, toIn(d), opts.open, alloc);
    } else if (seats[0]) {
      applyToUnit(pieces, seats[0], d);
    } else {
      insertGap(pieces, at, toIn(d), opts.open, alloc);
    }
    return true;
  }
  let need = -d;
  for (const u of [...gaps, ...seats]) {
    const cap = u.kind === 'gap' ? u.size : u.size - toH(ABSORB_FLOOR);
    if (cap <= 0) continue;
    const take = Math.min(cap, need);
    applyToUnit(pieces, u, -take);
    need -= take;
    if (need === 0) return true;
  }
  return false;
}

/**
 * Lock-aware piece-edit settlement (§5.4 "Lock"). Lock ON: the absorber rule
 * keeps the run's total. Lock OFF: needed space comes from gaps first (nearest
 * first) and the rest grows the run; freed space becomes a gap if the run has
 * gaps, otherwise the run shrinks. W/L/R are re-derived afterwards.
 */
export function settle(d: Config, run: RunId, anchor: Anchor, delta: number, alloc: Alloc, exclude?: Set<string>): boolean {
  const pieces = d.runs[run]!;
  const A = d.dims.A;
  const open = openEnd(d.shape, run);
  if (d.lockOutside) return absorb(pieces, anchor, delta, A, alloc, { mode: 'piece', exclude, open });
  const h = toH(delta);
  if (h > 0) {
    if (pieces.some((p) => p.kind === 'gap')) insertGap(pieces, 'seam' in anchor ? anchor.seam : anchor.piece + 1, delta, open, alloc);
    return true;
  }
  let need = -h;
  const { gaps } = collectUnits(pieces, A, anchor, exclude ?? new Set());
  for (const g of gaps) {
    const take = Math.min(g.size, need);
    applyToUnit(pieces, g, -take);
    need -= take;
    if (need === 0) break;
  }
  return true;
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
  open: RunEnd | null,
): boolean {
  const steps: [RunEnd, number][] = [
    ['start', startDelta],
    ['end', endDelta],
  ];
  steps.sort((a, b) => b[1] - a[1]);
  for (const [end, delta] of steps) {
    const anchor = end === 'start' ? { seam: 0 } : { seam: pieces.length };
    if (!absorb(pieces, anchor, delta, A, alloc, { mode: 'measure', open })) return false;
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
    if (!rebalanceEnds(d.runs[run]!, s, e, d.dims.A, alloc, openEnd(d.shape, run))) return false;
  }
  return true;
}
