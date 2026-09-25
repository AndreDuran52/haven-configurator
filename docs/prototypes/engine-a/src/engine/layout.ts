// Run geometry, default fill, auto-split / re-merge, rebalancing (absorption),
// table placement and blank-mode gaps. Everything here works on a DRAFT
// (a clone owned by one op), so it may mutate its arguments.
import {
  ABSORB_FLOOR,
  MAX_PIECE,
  MIN_SEAT,
  TABLE_MAX,
  TABLE_MIN,
  WEDGE_AUTO_OFFSET,
  WEDGE_RANGE,
  cushionOf,
  distribute,
  half,
  isSeat,
  splitHalf,
  splitLengths,
} from './pieces';
import type {
  Config,
  CornerId,
  EndCapState,
  EndKind,
  Placement,
  RunEnd,
  RunId,
  RunPiece,
  Runs,
  Shape,
} from './types';

// ---------------------------------------------------------------------------
// Ids

export type Alloc = (prefix: 'p' | 'g') => string;

/** Ids come from the draft's own counter, so ops stay pure and replayable. */
export const makeAlloc =
  (draft: Config): Alloc =>
  (prefix) =>
    `${prefix}${draft.nextId++}`;

// ---------------------------------------------------------------------------
// Shape / run geometry (§8)

export const autoWedge = (D: number): number => D + WEDGE_AUTO_OFFSET;
export const clampWedge = (C: number, D: number): number => Math.min(D + WEDGE_RANGE, Math.max(D, C));
export const wedgeC = (c: Pick<Config, 'D' | 'wedgeC'>): number => (c.wedgeC === null ? autoWedge(c.D) : c.wedgeC);

export function runIds(shape: Shape): RunId[] {
  if (shape === 'U') return ['back', 'left', 'right'];
  return shape === 'L-left' ? ['back', 'left'] : ['back', 'right'];
}

export function corners(shape: Shape): CornerId[] {
  if (shape === 'U') return ['backLeft', 'backRight'];
  return shape === 'L-left' ? ['backLeft'] : ['backRight'];
}

/** Runs are ordered by increasing x (back) or y (legs); legs start at their wedge. */
export function runEnds(shape: Shape, run: RunId): { start: EndKind; end: EndKind } {
  if (run !== 'back') return { start: 'wedge', end: 'open' };
  if (shape === 'U') return { start: 'wedge', end: 'wedge' };
  return shape === 'L-left' ? { start: 'wedge', end: 'open' } : { start: 'open', end: 'wedge' };
}

export function openEnd(shape: Shape, run: RunId): RunEnd | null {
  const e = runEnds(shape, run);
  if (e.end === 'open') return 'end';
  return e.start === 'open' ? 'start' : null;
}

/** Space available for pieces (§8). */
export function available(c: Pick<Config, 'shape' | 'W' | 'L' | 'R' | 'D' | 'wedgeC'>, run: RunId): number {
  const C = wedgeC(c);
  if (run === 'back') return c.shape === 'U' ? c.W - 2 * C : c.W - C;
  return (run === 'left' ? c.L : c.R) - C;
}

export const runSum = (pieces: RunPiece[]): number => pieces.reduce((s, p) => s + p.length, 0);

export function seat(id: string, length: number, arm: RunEnd | null): RunPiece {
  return arm ? { id, kind: 'oneArm', length, arm } : { id, kind: 'armless', length };
}

/** §8 default fill: arm at the open end (if any) + one seat for the rest; normalize auto-splits. */
export function defaultFill(len: number, open: RunEnd | null, A: number, alloc: Alloc): RunPiece[] {
  if (len <= 0) return [];
  const arm = open && len - A >= ABSORB_FLOOR ? open : null;
  return [seat(alloc('p'), len, arm)];
}

/** End cap is DERIVED from the pieces at the open end, never stored. */
export function endCapState(pieces: RunPiece[], open: RunEnd): EndCapState {
  const n = pieces.length;
  const end = pieces[open === 'end' ? n - 1 : 0];
  if (!end || end.kind === 'gap') return 'unfilled';
  if (end.kind === 'oneArm' && end.arm === open) return 'arm';
  if (end.kind === 'table') {
    const inner = pieces[open === 'end' ? n - 2 : 1];
    return inner?.kind === 'oneArm' && inner.arm === open ? 'armTable' : 'table';
  }
  return 'open';
}

export function dissolveGroup(pieces: RunPiece[], group: string | undefined): void {
  if (!group) return;
  for (const p of pieces) if (p.splitGroup === group) delete p.splitGroup;
}

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

// ---------------------------------------------------------------------------
// Normalisation (runs after every op): gaps, split groups, auto-split.

function validBlock(pieces: RunPiece[], block: number[]): boolean {
  const arms = block.filter((i) => pieces[i]!.kind === 'oneArm');
  if (arms.length === 0) return true;
  if (arms.length > 1) return false;
  const i = arms[0]!;
  return pieces[i]!.arm === 'start' ? i === block[0] : i === block[block.length - 1];
}

export function normalizeRun(input: RunPiece[], A: number, alloc: Alloc): RunPiece[] {
  // 1. Merge adjacent gaps, drop empty ones.
  const merged: RunPiece[] = [];
  for (const p of input) {
    if (p.kind === 'gap') {
      if (p.length <= 0) continue;
      const last = merged[merged.length - 1];
      if (last?.kind === 'gap') {
        last.length += p.length;
        continue;
      }
    }
    merged.push({ ...p });
  }
  // 2. A split group must be one contiguous block of seats with its arm at the
  //    matching end; otherwise it dissolves (the pieces become user-owned).
  const blocks = new Map<string, number[][]>();
  merged.forEach((p, i) => {
    if (!p.splitGroup) return;
    if (!isSeat(p)) {
      delete p.splitGroup;
      return;
    }
    const list = blocks.get(p.splitGroup) ?? [];
    const last = list[list.length - 1];
    if (last && last[last.length - 1] === i - 1) last.push(i);
    else list.push([i]);
    blocks.set(p.splitGroup, list);
  });
  for (const list of blocks.values()) {
    if (list.length === 1 && validBlock(merged, list[0]!)) continue;
    for (const b of list) for (const i of b) delete merged[i]!.splitGroup;
  }
  // 3. Every logical seat (a lone seat or a whole group) is re-split into the
  //    fewest equal-cushion pieces <= 108". Groups re-merge when they fit.
  const out: RunPiece[] = [];
  for (let i = 0; i < merged.length; ) {
    const p = merged[i]!;
    if (!isSeat(p)) {
      out.push(p);
      i++;
      continue;
    }
    const block = [p];
    if (p.splitGroup) while (merged[i + block.length]?.splitGroup === p.splitGroup) block.push(merged[i + block.length]!);
    i += block.length;
    if (block.length === 1 && p.length <= MAX_PIECE) {
      delete p.splitGroup;
      out.push(p);
      continue;
    }
    const total = runSum(block);
    const arm = block.find((q) => q.kind === 'oneArm')?.arm ?? null;
    const lengths = splitLengths(total, arm, A);
    if (lengths.length === 1) {
      out.push(seat(p.id, total, arm));
      continue;
    }
    const group = p.splitGroup ?? alloc('g');
    lengths.forEach((len, k) => {
      const hasArm = (arm === 'start' && k === 0) || (arm === 'end' && k === lengths.length - 1);
      out.push({ ...seat(block[k]?.id ?? alloc('p'), len, hasArm ? arm : null), splitGroup: group });
    });
  }
  return out;
}

/** Lock OFF: the outside sizes are whatever the pieces add up to. */
export function deriveOutside(c: Config): void {
  const C = wedgeC(c);
  const back = runSum(c.runs.back ?? []);
  c.W = c.shape === 'U' ? back + 2 * C : back + C;
  if (c.runs.left) c.L = runSum(c.runs.left) + C;
  if (c.runs.right) c.R = runSum(c.runs.right) + C;
}

/**
 * Normalise every run, derive W/L/R when unlocked, then assert the §8/§12.9
 * invariant (each run sums exactly to its available space). A failure here is
 * an engine bug, so it throws rather than returning a half-valid config.
 */
export function finalize(draft: Config, alloc: Alloc): Config {
  const ids = runIds(draft.shape);
  const runs: Runs = {};
  for (const r of ids) runs[r] = normalizeRun(draft.runs[r] ?? [], draft.dims.A, alloc);
  draft.runs = runs;
  if (!draft.lockOutside) deriveOutside(draft);
  for (const r of ids) {
    const av = available(draft, r);
    const sum = runSum(runs[r]!);
    if (av < 0 || sum !== av) throw new Error(`engine invariant: run ${r} sums ${sum}, available ${av}`);
    for (const p of runs[r]!) {
      if (p.length <= 0 || half(p.length) !== p.length || (p.kind !== 'gap' && p.length > MAX_PIECE)) {
        throw new Error(`engine invariant: bad piece ${JSON.stringify(p)}`);
      }
    }
  }
  return draft;
}
