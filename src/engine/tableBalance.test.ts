// Balance seats around a table (Andre, 2026-11-06, with the Nick drawing: a U
// 170 × 140, 55″ wedges, each leg 27 | table 20 | 26 + 12 arm).
import { describe, expect, it } from 'vitest';
import { evenTableSeats, tableSeats, TABLE_MID } from './balance';
import { standardL, standardU } from './defaults';
import { moveTable } from './tableOps';
import { setArmWidth } from './ops';
import { addPiece, resizePiece } from './pieceOps';
import { deepFreeze, desc, valid } from './testing';
import type { Config, RunId } from './types';

const dropTable = (c: Config, run: RunId, i = 0, length?: number) =>
  addPiece(c, 'table', { run, at: 'split', pieceId: c.runs[run]![i]!.id }, length ? { length } : {});
const tableIn = (c: Config, run: RunId) => c.runs[run]!.find((p) => p.kind === 'table')!.id;
/** The first seat made 5″ wider by hand (the absorber rule takes it from the other seat). */
const uneven = (c: Config) => resizePiece(c, c.runs.left![0]!.id, c.runs.left![0]!.length + 5).config;
const nick = () => standardU({ W: 170, L: 140, R: 140, wedgeC: 55, dims: { A: 12 } });

describe('a new table dropped into a seat starts at 20″ with equal seats', () => {
  it('Standard U leg (72 = 58 + 14): 19 | 20 | 19', () => {
    const r = dropTable(deepFreeze(standardU()), 'left');
    expect(r.rejected).toBeNull();
    valid(r.config);
    expect(TABLE_MID).toBe(20);
    expect(desc(r.config, 'left')).toEqual(['armless 19', 'table 20', 'oneArm 33=19+14@end']);
    expect(tableSeats(r.config, tableIn(r.config, 'left'))).toEqual([19, 19]);
  });

  it("Nick's leg (140, wedge 55, arm 12): 26½ | 20 | 26½, as his drawing", () => {
    const c = nick();
    expect(desc(c, 'left')).toEqual(['oneArm 85=73+12@end']);
    const r = dropTable(c, 'left');
    valid(r.config);
    expect(tableSeats(r.config, tableIn(r.config, 'left'))).toEqual([26.5, 26.5]);
    expect(r.config.L).toBe(140);
  });

  it('an explicit width is kept; a table at a seam or an end keeps the 32″ default', () => {
    const c = standardL('left', { W: 200 });
    expect(desc(dropTable(c, 'back', 0, 24).config, 'back').filter((d) => d.startsWith('table'))).toEqual(['table 24']);
    const seam = addPiece(c, 'table', { run: 'back', at: 'seam', seam: 1 });
    expect(desc(seam.config, 'back')).toContain('table 32');
  });

  it('moving an existing table into a seat keeps its width', () => {
    const c = standardU(); // back: table 32 | armless 36
    const t = tableIn(c, 'back');
    const r = moveTable(c, t, { run: 'left', at: 'split', pieceId: c.runs.left![0]!.id });
    expect(r.rejected).toBeNull();
    expect(desc(r.config, 'left')).toContain('table 32');
  });
});

describe('resizing the table keeps its seats equal', () => {
  it('20 → 24 takes 2″ from each seat; 24 → 23½ gives ½ back: the extra ½ goes away from the arm', () => {
    const c0 = deepFreeze(dropTable(nick(), 'left').config);
    const id = tableIn(c0, 'left');
    const r = resizePiece(c0, id, 24);
    valid(r.config);
    expect(tableSeats(r.config, id)).toEqual([24.5, 24.5]);
    const s = resizePiece(r.config, id, 23.5).config;
    valid(s);
    expect(tableSeats(s, id)).toEqual([25, 24.5]);
    expect(s.L).toBe(140);
  });

  it('refused (same reference) when a seat would go under 6″', () => {
    const c = dropTable(standardU({ L: 112 }), 'left').config; // 9 | 20 | 9
    expect(tableSeats(c, tableIn(c, 'left'))).toEqual([9, 9]);
    const r = resizePiece(c, tableIn(c, 'left'), 28);
    expect(r.rejected).not.toBeNull();
    expect(r.config).toBe(c);
  });

  it('lock off: the run grows, the seats keep their size', () => {
    const c = dropTable(standardU({ lockOutside: false }), 'left').config;
    const id = tableIn(c, 'left');
    const before = tableSeats(c, id);
    const r = resizePiece(c, id, 24);
    valid(r.config);
    expect(r.config.L).toBe(c.L + 4);
    expect(tableSeats(r.config, id)).toEqual(before);
  });
});

describe('Even seats', () => {
  it('after a hand resize, Even seats shares the cushions again; the run is unchanged', () => {
    const c = dropTable(nick(), 'left').config;
    const id = tableIn(c, 'left');
    const dragged = uneven(c);
    expect(tableSeats(dragged, id)).toEqual([31.5, 21.5]);
    const r = evenTableSeats(dragged, id);
    valid(r.config);
    expect(tableSeats(r.config, id)).toEqual([26.5, 26.5]);
  });

  it('already even, or no seat pair: same reference', () => {
    const c = dropTable(nick(), 'left').config;
    expect(evenTableSeats(c, tableIn(c, 'left')).config).toBe(c);
    const u = standardU();
    const r = evenTableSeats(u, tableIn(u, 'back'));
    expect(r.config).toBe(u);
    expect(r.rejected?.message).toBe('This table needs a seat on each side');
  });
});

describe('arm width keeps an even pair even', () => {
  it('Standard U leg with a table, arms 14 → 10: 21 | 20 | 21, leg length held', () => {
    const c = dropTable(standardU(), 'left').config;
    const r = setArmWidth(c, 10);
    valid(r.config);
    expect(desc(r.config, 'left')).toEqual(['armless 21', 'table 20', 'oneArm 31=21+10@end']);
    expect(r.config.L).toBe(132);
  });

  it('an uneven pair is left as the absorber rule leaves it', () => {
    const c = dropTable(nick(), 'left').config;
    const id = tableIn(c, 'left');
    const dragged = uneven(c);
    const r = setArmWidth(dragged, 10).config;
    valid(r);
    const [a, b] = tableSeats(r, id)!;
    expect(a).not.toBe(b);
  });
});
