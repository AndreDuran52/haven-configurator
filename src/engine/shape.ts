// Switching shape in place (UX Phase 3c, Andre 2026-11-09: "the seats stay").
// Every seat and table keeps its size; the width changes by the corner.
// - A back end that loses its corner gets an arm: an armless seat at that end
//   becomes one-arm (cushion kept). A table or gap at that end stays as it is.
// - A back end that gains a corner loses the arms facing it (cushion kept).
// - Legs: U -> L keeps one; L -> U adds a copy of the existing leg (a mirror);
//   Straight -> L or U adds standard 132″ legs; to Straight drops them.
// - L left <-> L right is a mirror (the back reverses, the leg is copied).
// Loose pieces move with the back seats. Switching back gives the same sofa.
import { DEFAULT_MEASURES } from './defaults';
import { corners, defaultFill, endIndex, runEnds, runIds, runSum, wedgeC, type Alloc } from './layout';
import { edit, type Outcome } from './edit';
import { half } from './pieces';
import type { Config, EditResult, RunEnd, RunId, RunPiece, Shape } from './types';

/** The standard side length a new leg gets (Straight -> L or U). */
export const STANDARD_SIDE = DEFAULT_MEASURES.L;

/** x where the back run starts: after the left corner when there is one. */
const backX = (c: Config): number => (corners(c.shape).includes('backLeft') ? wedgeC(c) : 0);

/**
 * How far the back seats moved in x from `a` to `b` (loose pieces and a placed
 * room follow it): the end of the back's first piece, whose arm (if any) is on
 * its outer side, so its cushion and everything after it shift by this much.
 */
export function backShift(a: Config, b: Config): number {
  const end = (c: Config) => backX(c) + (c.runs.back?.[0]?.length ?? 0);
  return end(b) - end(a);
}

/** A copy of a leg's pieces with fresh ids (split groups and table joins follow the copy). */
export function cloneRun(pieces: RunPiece[], alloc: Alloc): RunPiece[] {
  const ids = new Map<string, string>();
  const groups = new Map<string, string>();
  for (const p of pieces) ids.set(p.id, alloc('p'));
  return pieces.map((p) => {
    const q: RunPiece = { ...p, id: ids.get(p.id)! };
    if (p.splitGroup) {
      if (!groups.has(p.splitGroup)) groups.set(p.splitGroup, alloc('g'));
      q.splitGroup = groups.get(p.splitGroup)!;
    }
    if (p.joinedBy) q.joinedBy = ids.get(p.joinedBy) ?? p.joinedBy;
    return q;
  });
}

/**
 * The corner at `end` goes: the seat at that end takes an arm on its outer
 * side (cushion kept). A seat that already has its one arm (an L's one-seat
 * back, or a long seat split in two) keeps it: that end stays open.
 */
function armEnd(back: RunPiece[], end: RunEnd, A: number): void {
  const p = back[endIndex(back, end)];
  if (p?.kind !== 'armless') return;
  if (p.splitGroup && back.some((q) => q.splitGroup === p.splitGroup && q.kind === 'oneArm')) return;
  p.kind = 'oneArm';
  p.arm = end;
  p.length = half(p.length + A);
}

/** A corner comes at `end`: every arm facing it goes (cushion kept). */
function unarmEnd(back: RunPiece[], end: RunEnd, A: number): void {
  for (const p of back) {
    if (p.kind !== 'oneArm' || p.arm !== end) continue;
    p.kind = 'armless';
    delete p.arm;
    p.length = half(p.length - A);
  }
}

const isL = (s: Shape) => s === 'L-left' || s === 'L-right';
const legsOf = (s: Shape): RunId[] => runIds(s).filter((r) => r !== 'back');
const sideOf = (leg: RunId): 'L' | 'R' => (leg === 'left' ? 'L' : 'R');

/** L left <-> L right: the back reverses (arms flip), the leg is copied, L and R swap, loose pieces mirror. */
function mirror(d: Config, shape: Shape): Outcome {
  const back = d.runs.back!.slice().reverse();
  for (const p of back) if (p.arm) p.arm = p.arm === 'start' ? 'end' : 'start';
  const leg = shape === 'L-right' ? d.runs.left! : d.runs.right!;
  d.runs = shape === 'L-right' ? { back, right: leg } : { back, left: leg };
  [d.L, d.R] = [d.R, d.L];
  d.shape = shape;
  d.loose = d.loose.map((p) => ({ ...p, x: half(d.W - p.x - p.w) }));
  return true;
}

export function setShape(config: Config, shape: Shape): EditResult {
  return edit(config, (d, alloc): Outcome => {
    if (d.shape === shape) return null;
    if (isL(d.shape) && isL(shape)) return mirror(d, shape);
    const A = d.dims.A;
    const C = wedgeC(d);
    const back = d.runs.back!;
    const was = runEnds(d.shape, 'back');
    const will = runEnds(shape, 'back');
    for (const end of ['start', 'end'] as const) {
      if (was[end] === 'wedge' && will[end] === 'open') armEnd(back, end, A);
      if (was[end] === 'open' && will[end] === 'wedge') unarmEnd(back, end, A);
    }
    const runs: Config['runs'] = { back };
    const kept = legsOf(d.shape);
    for (const leg of legsOf(shape)) {
      if (kept.includes(leg)) {
        runs[leg] = d.runs[leg]!;
      } else if (kept.length) {
        // L -> U: the new leg is a copy of the existing one (Andre: "adds a mirror of the existing leg").
        const from = kept[0]!;
        runs[leg] = cloneRun(d.runs[from]!, alloc);
        d[sideOf(leg)] = d[sideOf(from)];
      } else {
        // Straight -> L or U: standard legs.
        d[sideOf(leg)] = STANDARD_SIDE;
        runs[leg] = defaultFill(STANDARD_SIDE - C, ['end'], A, alloc);
      }
    }
    // A straight sofa has no legs: L and R sit at the depth (as a new straight sofa's do).
    if (shape === 'straight') [d.L, d.R] = [d.D, d.D];
    d.shape = shape;
    d.runs = runs;
    d.W = half(runSum(back) + corners(shape).length * C);
    const dx = backShift(config, d);
    if (dx) d.loose = d.loose.map((p) => ({ ...p, x: half(p.x + dx) }));
    return true;
  });
}
