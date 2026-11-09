// Where a new table goes (Andre, 2026-11-09). A table goes between cushions
// (at a seam); at an open end it takes the arm's place (seat | table, never
// seat | arm | table: Andre, Phase 3c fixes, Q72); and it may split a seat in
// two when both halves stay 23″ or more (Q73). A new table starts at the
// standard 32″; if that would leave a seat under 23″ it steps down to 28, 24,
// then 20″; if none fits: "Not enough seat for a table here." Between two seats
// with the lock on, both seats shrink equally (placement.ts shareSeam); with
// the lock off the seats keep their size and the sofa grows. Saved layouts and
// links are never re-placed: only new edits use this.
import { buildHaven } from './buildHaven';
import { edit, noRoom } from './edit';
import { endCapState, openEnds, runIds } from './layout';
import { cushionOf, isSeat, SEAT_WARN, TABLE_DEFAULT } from './pieces';
import { insertPiece } from './placement';
import type { Config, EditResult, Placement, Pt } from './types';

/** A new table's widths, tried in order. */
export const TABLE_STEPS = [TABLE_DEFAULT, 28, 24, 20] as const;
export const NO_TABLE_ROOM = 'Not enough seat for a table here.';

/** Seat cushions by id, every run. */
function cushions(c: Config): Map<string, number> {
  const out = new Map<string, number>();
  for (const run of runIds(c.shape)) for (const p of c.runs[run] ?? []) if (isSeat(p)) out.set(p.id, cushionOf(p, c.dims.A));
  return out;
}

/** True unless the edit left a seat it shrank (or a new seat) under 23″. */
export function tableFits(before: Config, after: Config): boolean {
  const was = cushions(before);
  for (const [id, c] of cushions(after)) {
    if (c >= SEAT_WARN) continue;
    const c0 = was.get(id);
    if (c0 === undefined || c < c0) return false;
  }
  return true;
}

/** One table of width w at the placement (the new table's id is allocated first). */
const tableAt = (config: Config, placement: Placement, w: number): EditResult =>
  edit(config, (d, alloc) => insertPiece(d, alloc, { id: alloc('p'), kind: 'table', length: w }, placement));

/** A new table at the placement: 32″, else the widest step that leaves every seat it shrinks at 23″ or more. */
export function addTable(config: Config, placement: Placement): EditResult {
  for (const w of TABLE_STEPS) {
    const r = tableAt(config, placement, w);
    if (!r.rejected && r.config !== config && tableFits(config, r.config)) return r;
  }
  return { config, rejected: noRoom(NO_TABLE_ROOM) };
}

export interface TableTarget {
  placement: Placement;
  config: Config;
}

/** How many pairs of tables sit right next to each other (no seat between), every run. */
export function touchingTables(c: Config): number {
  let n = 0;
  for (const run of runIds(c.shape)) {
    const ps = c.runs[run] ?? [];
    for (let i = 1; i < ps.length; i++) if (ps[i]!.kind === 'table' && ps[i - 1]!.kind === 'table') n++;
  }
  return n;
}

/**
 * A placement never puts a table right next to another one (Andre, Phase 3c
 * round 2: two tables touching read as one long table). Layouts that already
 * have touching tables are left as they are; only new spots are checked.
 */
export const noNewTouch = (before: Config, after: Config): boolean => touchingTables(after) <= touchingTables(before);

/**
 * Every place a new table can go: each seam where it fits, except beyond an
 * arm (there the table takes the arm's place instead), and the middle of each
 * seat whose two halves stay 23″ or more; never right next to another table.
 */
export function tableTargets(config: Config): TableTarget[] {
  const out: TableTarget[] = [];
  const add = (placement: Placement) => {
    const r = addTable(config, placement);
    if (!r.rejected && noNewTouch(config, r.config)) out.push({ placement, config: r.config });
  };
  for (const run of runIds(config.shape)) {
    const ps = config.runs[run] ?? [];
    const opens = openEnds(config.shape, run);
    const armed = opens.filter((e) => endCapState(ps, e) === 'arm');
    const beyondArm = armed.map((e) => (e === 'end' ? ps.length : 0));
    for (let seam = 0; seam <= ps.length; seam++) if (!beyondArm.includes(seam)) add({ run, at: 'seam', seam });
    for (const end of armed) add({ run, at: 'replaceArm', end });
    for (const p of ps) if (isSeat(p)) add({ run, at: 'split', pieceId: p.id });
  }
  return out;
}

/** The new table's centre in plan inches (it is the piece with the config's next id). */
export function newTableCentre(before: Config, after: Config): Pt | null {
  const p = buildHaven(after).pieces.find((q) => q.id === `p${before.nextId}`);
  return p ? [p.bbox.x + p.bbox.w / 2, p.bbox.y + p.bbox.h / 2] : null;
}

/**
 * "Table in the middle" (the tray's Table tapped, not dragged): the target whose
 * table sits nearest the middle of the back run, (W/2, D/2); ties keep the
 * first run (back, left, right). Refused when no place fits.
 */
export function centralTable(config: Config): EditResult & { placement: Placement | null } {
  const b = buildHaven(config);
  const mid: Pt = [b.W / 2, b.D / 2];
  let best: { t: TableTarget; d: number } | null = null;
  for (const t of tableTargets(config)) {
    const c = newTableCentre(config, t.config);
    if (!c) continue;
    const d = Math.hypot(c[0] - mid[0], c[1] - mid[1]);
    if (!best || d < best.d - 1e-9) best = { t, d };
  }
  if (!best) return { config, rejected: noRoom(NO_TABLE_ROOM), placement: null };
  return { config: best.t.config, rejected: null, placement: best.t.placement };
}
