// Run geometry, default fill and derived end caps (§8). absorb.ts, placement.ts
// and normalize.ts hold the rest of the prototype's layout.ts.
import { ABSORB_FLOOR, MAX_PIECE, WEDGE_AUTO_OFFSET, WEDGE_RANGE, distribute } from './pieces';
import type { Config, CornerId, EndCapState, EndKind, RunEnd, RunId, RunPiece, Shape } from './types';

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
  if (shape === 'straight') return ['back'];
  if (shape === 'U') return ['back', 'left', 'right'];
  return shape === 'L-left' ? ['back', 'left'] : ['back', 'right'];
}

export function corners(shape: Shape): CornerId[] {
  if (shape === 'straight') return [];
  if (shape === 'U') return ['backLeft', 'backRight'];
  return shape === 'L-left' ? ['backLeft'] : ['backRight'];
}

/** Runs are ordered by increasing x (back) or y (legs); legs start at their wedge. */
export function runEnds(shape: Shape, run: RunId): { start: EndKind; end: EndKind } {
  if (run !== 'back') return { start: 'wedge', end: 'open' };
  if (shape === 'straight') return { start: 'open', end: 'open' };
  if (shape === 'U') return { start: 'wedge', end: 'wedge' };
  return shape === 'L-left' ? { start: 'wedge', end: 'open' } : { start: 'open', end: 'wedge' };
}

/** The run's open ends (where arms and end tables go): none, one, or both on a straight sofa. */
export function openEnds(shape: Shape, run: RunId): RunEnd[] {
  const e = runEnds(shape, run);
  return (['start', 'end'] as const).filter((k) => e[k] === 'open');
}

/** The single open end, or null when the run has none or two (link codec, single-end UI). */
export function openEnd(shape: Shape, run: RunId): RunEnd | null {
  const o = openEnds(shape, run);
  return o.length === 1 ? o[0]! : null;
}

/**
 * The open end an arm on the seat at index i would face: the end it sits at
 * (or with one table between), 'end' first. Falls back to the run's first
 * open end (G11 then refuses), or null when the run has none.
 */
export function armEndFor(pieces: RunPiece[], i: number, opens: RunEnd[]): RunEnd | null {
  for (const end of ['end', 'start'] as const) {
    if (!opens.includes(end)) continue;
    const between = end === 'end' ? pieces.slice(i + 1) : pieces.slice(0, i);
    if (between.length === 0 || (between.length === 1 && between[0]!.kind === 'table')) return end;
  }
  return opens[0] ?? null;
}

/** The open end an end-cap edit acts on: `end` if it is open, else the only open end ('end' on a straight run). */
export function capEnd(opens: RunEnd[], end?: RunEnd): RunEnd | null {
  if (end) return opens.includes(end) ? end : null;
  return opens.length === 1 ? opens[0]! : opens.includes('end') ? 'end' : null;
}

/** The open end a piece at index i sits at, if any (on a straight run: the first piece is at 'start'). */
export function endAt(opens: RunEnd[], i: number, n: number): RunEnd | null {
  if (i === n - 1 && opens.includes('end')) return 'end';
  return i === 0 && opens.includes('start') ? 'start' : null;
}

/** Space available for pieces (§8). */
export function available(c: Pick<Config, 'shape' | 'W' | 'L' | 'R' | 'D' | 'wedgeC'>, run: RunId): number {
  const C = wedgeC(c);
  if (run === 'back') return c.shape === 'straight' ? c.W : c.shape === 'U' ? c.W - 2 * C : c.W - C;
  return (run === 'left' ? c.L : c.R) - C;
}

export const runSum = (pieces: RunPiece[]): number => pieces.reduce((s, p) => s + p.length, 0);

export function seat(id: string, length: number, arm: RunEnd | null): RunPiece {
  return arm ? { id, kind: 'oneArm', length, arm } : { id, kind: 'armless', length };
}

/**
 * §8 default fill: one seat for the whole run, with an arm at the open end if
 * its cushion stays >= 6. A straight run (both ends open) gets two equal
 * one-arm seats, arms out (armless seats between them past 2 × 108).
 */
export function defaultFill(len: number, opens: RunEnd[], A: number, alloc: Alloc): RunPiece[] {
  if (len <= 0) return [];
  if (len < ABSORB_FLOOR) return [{ id: alloc('p'), kind: 'gap', length: len }];
  if (opens.length === 2) {
    const n = Math.max(2, Math.ceil(len / MAX_PIECE));
    const lengths = distribute(len, n, null);
    if (lengths[0]! - A >= ABSORB_FLOOR) return lengths.map((l, i) => seat(alloc('p'), l, i === 0 ? 'start' : i === n - 1 ? 'end' : null));
  }
  const open = opens[0];
  const arm = open && len - A >= ABSORB_FLOOR ? open : null;
  return [seat(alloc('p'), len, arm)];
}

/** Index of the piece at a run end. */
export const endIndex = (pieces: RunPiece[], end: RunEnd): number => (end === 'end' ? pieces.length - 1 : 0);

/** End cap is DERIVED from the pieces at the open end, never stored. */
export function endCapState(pieces: RunPiece[], open: RunEnd): EndCapState {
  const n = pieces.length;
  const end = pieces[endIndex(pieces, open)];
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

/** G1: a manual edit of a split half clears both halves' tags. */
export function clearJoin(pieces: RunPiece[], tag: string | undefined): void {
  if (!tag) return;
  for (const p of pieces) if (p.joinedBy === tag) delete p.joinedBy;
}

/** A manual edit of a piece: it leaves its split group and its G1 pair. */
export function detach(pieces: RunPiece[], p: RunPiece): void {
  dissolveGroup(pieces, p.splitGroup);
  clearJoin(pieces, p.joinedBy);
}
