// Normalisation after every op: gaps, split groups, auto-split (G9) and G1
// join tags. finalize() = normalise + derive W/L/R + assert the invariants.
import { MAX_PIECE, isSeat, splitLengths } from './pieces';
import { runIds, runSum, seat, wedgeC, type Alloc } from './layout';
import { assertInvariants } from './rules';
import type { Config, RunPiece, Runs } from './types';

function validBlock(pieces: RunPiece[], block: number[]): boolean {
  const arms = block.filter((i) => pieces[i]!.kind === 'oneArm');
  if (arms.length === 0) return true;
  if (arms.length > 1) return false;
  const i = arms[0]!;
  return pieces[i]!.arm === 'start' ? i === block[0] : i === block[block.length - 1];
}

/**
 * G1 tags survive only while the table sits directly between its two halves
 * (lone seats, not split-group members); anything else clears them.
 */
function validateJoins(pieces: RunPiece[]): void {
  const tags = new Set(pieces.flatMap((p) => (p.joinedBy ? [p.joinedBy] : [])));
  for (const tag of tags) {
    const idx = pieces.flatMap((p, i) => (p.joinedBy === tag ? [i] : []));
    const t = pieces[idx[0]! + 1];
    const ok =
      idx.length === 2 &&
      idx[1] === idx[0]! + 2 &&
      t?.kind === 'table' &&
      t.id === tag &&
      idx.every((i) => isSeat(pieces[i]!) && !pieces[i]!.splitGroup);
    if (!ok) for (const i of idx) delete pieces[i]!.joinedBy;
  }
}

export function normalizeRun(input: RunPiece[], alloc: Alloc): RunPiece[] {
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
  // 3. Every logical seat (a lone seat or a whole group) is re-split into
  //    ceil(len / 108) pieces of equal footprint. Groups re-merge when they fit.
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
    const lengths = splitLengths(total, arm);
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
  validateJoins(out);
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

/** Normalise every run of the shape (dropping runs it lacks) and derive W/L/R when unlocked. */
export function normalizeConfig(draft: Config, alloc: Alloc): void {
  const runs: Runs = {};
  for (const r of runIds(draft.shape)) runs[r] = normalizeRun(draft.runs[r] ?? [], alloc);
  draft.runs = runs;
  if (!draft.lockOutside) deriveOutside(draft);
}

/**
 * Normalise, then assert the §11 invariant. A failure here is an engine bug
 * (ops refuse rule breaks before this point), so it throws.
 */
export function finalize(draft: Config, alloc: Alloc): Config {
  normalizeConfig(draft, alloc);
  assertInvariants(draft);
  return draft;
}
