// Normalisation after every op (gaps, split groups, auto-split) and the
// finalize() invariant check.
import { MAX_PIECE, half, isSeat, splitLengths } from './pieces';
import { available, runIds, runSum, seat, wedgeC, type Alloc } from './layout';
import type { Config, RunPiece, Runs } from './types';

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
