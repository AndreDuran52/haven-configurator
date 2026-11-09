// Table moves and table-drag snapping (§5.4 "Tables", §6).
import { buildHaven } from './buildHaven';
import { cushionOf, isSeat } from './pieces';
import { settle } from './absorb';
import { endCapState, endIndex, openEnds, runIds, type Alloc } from './layout';
import { insertPiece, takeTable } from './placement';
import { edit, findPiece, noRoom, notAllowed, type Outcome } from './edit';
import { tableFits } from './tablePlace';
import type { BuildResult, Config, EditResult, Placement, Pt, RunEnd, RunId } from './types';

/** Snap hysteresis: a new anchor must be this much nearer than the current one (§5.4). */
export const SNAP_HYSTERESIS = 6;

/**
 * Body of moveTable, on a draft. The table comes out first and (G1) the seat it
 * split merges back; every placement is resolved against that run. Same run +
 * seam = a pure reorder (no lengths change). Anywhere else: the source run
 * absorbs the freed width (or shrinks, lock off), then the table is placed.
 */
export function moveTableIn(d: Config, alloc: Alloc, id: string, placement: Placement): Outcome {
  const f = findPiece(d, id);
  if (!f || f.piece.kind !== 'table') return notAllowed('No such table');
  const src = d.runs[f.run]!;
  const { table, anchor, merged } = takeTable(src, f.index);
  if (placement.run === f.run && placement.at === 'seam') {
    const s = placement.seam;
    if (!Number.isInteger(s) || s < 0 || s > src.length) return notAllowed('No such seam');
    if (!merged && s === f.index) return null;
    src.splice(s, 0, table);
    return true;
  }
  if (!settle(d, f.run, anchor, table.length, alloc)) return noRoom();
  return insertPiece(d, alloc, table, placement);
}

export function moveTable(config: Config, id: string, placement: Placement): EditResult {
  return edit(config, (d, alloc) => moveTableIn(d, alloc, id, placement));
}

/** The config with the table taken out (G1 merge applied, width absorbed), for drag anchors. */
function withoutTable(config: Config, id: string): Config {
  const r = edit(config, (d, alloc): Outcome => {
    const f = findPiece(d, id)!;
    const { table, anchor } = takeTable(d.runs[f.run]!, f.index);
    return settle(d, f.run, anchor, table.length, alloc) || noRoom();
  });
  return r.config;
}

const centre = (b: BuildResult, id: string): Pt | null => {
  const p = b.pieces.find((q) => q.id === id);
  return p ? [p.bbox.x + p.bbox.w / 2, p.bbox.y + p.bbox.h / 2] : null;
};

/** A point `dist` inches along the run from its open end (negative = beyond the end), mid-depth. */
function alongFromOpenEnd(b: BuildResult, run: RunId, end: RunEnd, dist: number): Pt {
  const r = b.runs.find((q) => q.id === run)!;
  const s = end === 'start' ? dist : r.available - dist;
  const inward = run === 'right' ? -1 : 1;
  const across = (r.axis === 'x' ? r.origin[1] : r.origin[0]) + (inward * b.D) / 2;
  return r.axis === 'x' ? [r.origin[0] + s, across] : [across, r.origin[1] + s];
}

/**
 * Every place the table can snap to while dragged, with its anchor point in
 * plan inches: each seam (the table's centre once placed), plus the two
 * run-end anchors: `replaceArm` on the arm's centre, and "outside the arm"
 * half a table beyond the open end. Andre (2026-11-09): a table goes between
 * cushions, keeps its width, and only where every seat it shrinks stays at
 * 23″ or more; a run with no such seam offers one centred split of its largest
 * seat. Placements are resolved against the config with the table removed (G1).
 */
export function anchoredTargets(config: Config, id: string): { placement: Placement; anchor: Pt }[] {
  const f = findPiece(config, id);
  if (!f || f.piece.kind !== 'table') return [];
  const w = f.piece.length;
  const postBuilt = buildHaven(withoutTable(config, id));
  const out: { placement: Placement; anchor: Pt }[] = [];
  for (const run of runIds(config.shape)) {
    // moveTable resolves placements in the source run against the table-less list (G1 merge applied).
    const ps = run === f.run ? takeListForSource(config, id) : config.runs[run]!;
    const opens = openEnds(config.shape, run);
    const isArmAt = (e: RunEnd) => ps.length > 0 && ps[endIndex(ps, e)]!.kind === 'oneArm';
    const armSeams = opens.filter(isArmAt).map((e) => (e === 'end' ? ps.length : 0));
    /** The move, if it is allowed and leaves every seat it shrinks at 23″ or more. */
    const fits = (placement: Placement) => {
      const r = moveTable(config, id, placement);
      return !r.rejected && tableFits(config, r.config) ? r : null;
    };
    const before = out.length;
    for (let seam = 0; seam <= ps.length; seam++) {
      if (armSeams.includes(seam)) continue;
      const placement: Placement = { run, at: 'seam', seam };
      const r = fits(placement);
      const a = r && centre(buildHaven(r.config), id);
      if (a) out.push({ placement, anchor: a });
    }
    for (const open of opens) {
      const openSeam = open === 'end' ? ps.length : 0;
      const replace: Placement = opens.length > 1 ? { run, at: 'replaceArm', end: open } : { run, at: 'replaceArm' };
      if (endCapState(ps, open) === 'arm' && fits(replace)) {
        out.push({ placement: replace, anchor: alongFromOpenEnd(postBuilt, run, open, config.dims.A / 2) });
      }
      if (isArmAt(open) && fits({ run, at: 'seam', seam: openSeam })) {
        out.push({ placement: { run, at: 'seam', seam: openSeam }, anchor: alongFromOpenEnd(postBuilt, run, open, -w / 2) });
      }
    }
    // No seam in this run takes the table: one centred split of its largest seat.
    if (out.length === before) {
      const largest = ps.filter(isSeat).sort((a, b) => cushionOf(b, config.dims.A) - cushionOf(a, config.dims.A))[0];
      const placement: Placement | null = largest ? { run, at: 'split', pieceId: largest.id } : null;
      const r = placement && fits(placement);
      const a = r && centre(buildHaven(r.config), id);
      if (placement && a) out.push({ placement, anchor: a });
    }
  }
  return out;
}

/** The source run as moveTable resolves it: table removed, G1 halves merged, lengths untouched. */
function takeListForSource(config: Config, id: string) {
  const f = findPiece(config, id)!;
  const list = JSON.parse(JSON.stringify(config.runs[f.run])) as NonNullable<Config['runs'][RunId]>;
  takeTable(list, f.index);
  return list;
}

const samePlacement = (a: Placement, b: Placement) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Drag preview / drop: the anchor nearest the pointer wins, but the current
 * target is kept until another is SNAP_HYSTERESIS inches nearer. Always call it
 * with the DRAG-START config, so hovering on the way never leaves a trace.
 */
export function snapTable(
  startConfig: Config,
  id: string,
  pointer: Pt,
  current?: Placement,
): { placement: Placement | null; result: EditResult } {
  const targets = anchoredTargets(startConfig, id);
  const dist = (a: Pt) => Math.hypot(a[0] - pointer[0], a[1] - pointer[1]);
  let best: { placement: Placement; anchor: Pt } | null = null;
  for (const t of targets) if (!best || dist(t.anchor) < dist(best.anchor)) best = t;
  if (!best) return { placement: null, result: { config: startConfig, rejected: null } };
  const cur = current && targets.find((t) => samePlacement(t.placement, current));
  if (cur && dist(cur.anchor) - dist(best.anchor) <= SNAP_HYSTERESIS) best = cur;
  return { placement: best.placement, result: moveTable(startConfig, id, best.placement) };
}
