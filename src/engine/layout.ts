// Run geometry, default fill and derived end caps (§8). Split out of the
// prototype's layout.ts; absorb.ts, placement.ts and normalize.ts hold the rest.
import { ABSORB_FLOOR, WEDGE_AUTO_OFFSET, WEDGE_RANGE } from './pieces';
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
