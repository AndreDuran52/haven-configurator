// Table moves, reorder and table drag snapping (§6, §7).
import { buildHaven } from './buildHaven';
import { isSeat } from './pieces';
import { absorb } from './absorb';
import { runIds } from './layout';
import { insertPiece } from './placement';
import { edit, findPiece } from './ops';
import type { Config, Placement } from './types';

/**
 * §6 tables go anywhere. Same run + seam = pure reorder (no lengths change;
 * `seam` indexes the run WITHOUT the table). Otherwise: take it out (the
 * source run absorbs), then place it (the target run absorbs).
 */
export function moveTable(config: Config, id: string, placement: Placement): Config {
  return edit(config, (d, alloc) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind !== 'table') return false;
    const src = d.runs[f.run]!;
    src.splice(f.index, 1);
    if (placement.run === f.run && placement.at === 'seam') {
      if (placement.seam === f.index || placement.seam < 0 || placement.seam > src.length) return false;
      src.splice(placement.seam, 0, f.piece);
      return true;
    }
    if (d.lockOutside && !absorb(src, { seam: f.index }, f.piece.length, d.dims.A, alloc)) return false;
    return insertPiece(d, alloc, f.piece, placement);
  });
}

/** §7 reorder: drag a piece along its run. Pure permutation, lengths untouched. */
export function reorderPiece(config: Config, id: string, toIndex: number): Config {
  return edit(config, (d) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind === 'gap' || toIndex === f.index) return false;
    const pieces = d.runs[f.run]!;
    pieces.splice(f.index, 1);
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > pieces.length) return false;
    pieces.splice(toIndex, 0, f.piece);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Table dragging (§6): discrete snap targets, previewed with the pure ops.

/**
 * Every place a table can snap to by position: each seam of each run (seams of
 * the run WITHOUT this table) and the middle of each seat. 'replaceArm' is not
 * a drag target: it lands on the same spot as "outside the arm", so the UI
 * offers it through the end-cap menu instead.
 */
export function tableTargets(config: Config, id: string): Placement[] {
  const out: Placement[] = [];
  for (const run of runIds(config.shape)) {
    const ps = config.runs[run]!.filter((p) => p.id !== id);
    for (let seam = 0; seam <= ps.length; seam++) out.push({ run, at: 'seam', seam });
    for (const p of ps) if (isSeat(p)) out.push({ run, at: 'split', pieceId: p.id });
  }
  return out;
}

/**
 * Drag preview / drop: the feasible target whose resulting table centre is
 * nearest the pointer. Always call it with the DRAG-START config, so hovering
 * over targets on the way never leaves a trace.
 */
export function snapTable(config: Config, id: string, pointer: [number, number]): Config {
  let best = config;
  let bestDist = Infinity;
  for (const t of tableTargets(config, id)) {
    const next = moveTable(config, id, t);
    const p = buildHaven(next).pieces.find((q) => q.id === id);
    if (!p) continue;
    const cx = p.bbox.x + p.bbox.w / 2;
    const cy = p.bbox.y + p.bbox.h / 2;
    const dist = Math.hypot(cx - pointer[0], cy - pointer[1]);
    if (dist < bestDist) {
      best = next;
      bestDist = dist;
    }
  }
  return best;
}
