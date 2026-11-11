// UX Phase 3c, keep my work (Andre, 2026-11-09): Copy left to right / right to
// left on a U; seats even around a table stay even when a side, the width, the
// depth or the corner changes; the table ± grows from the middle.
import { describe, expect, it } from 'vitest';
import { tableSeats } from './balance';
import { standardL, standardStraight, standardU } from './defaults';
import { resetWedge, setLock, setMeasurements, setWedge } from './ops';
import { addPiece, resizePiece } from './pieceOps';
import { copySide, mirrorSides, sidesMatch } from './sides';
import { addTable, centralTable } from './tablePlace';
import { resizeTable, TABLE_SEAT_ROOM } from './tableSize';
import { deepFreeze, desc, valid } from './testing';
import type { Config } from './types';

const nick = () => standardU({ W: 170, L: 140, R: 140, wedgeC: 55, dims: { A: 12 } });
/** Nick's left leg with a table in the seat: 24½ | 24 | 24½. */
const nickTable = () => addPiece(nick(), 'table', { run: 'left', at: 'split', pieceId: nick().runs.left![0]!.id }).config;
const tableIn = (c: Config, run: 'back' | 'left' | 'right') => c.runs[run]!.find((p) => p.kind === 'table')!.id;
const ok = (r: { config: Config; rejected: unknown }) => {
  expect(r.rejected).toBeNull();
  valid(r.config);
  return r.config;
};

describe('Copy left to right / right to left', () => {
  it('the other side becomes a copy (fresh ids, joins follow), its length too; then each side edits on its own', () => {
    const c = deepFreeze(setMeasurements(nickTable(), { R: 120 }).config);
    expect(sidesMatch(c)).toBe(false);
    const r = ok(copySide(c, 'left'));
    expect(desc(r, 'right')).toEqual(desc(r, 'left'));
    expect([r.L, r.R, r.W]).toEqual([140, 140, 170]);
    expect(sidesMatch(r)).toBe(true);
    const ids = Object.values(r.runs).flatMap((p) => p!.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    const t = tableIn(r, 'right');
    expect(r.runs.right!.filter((p) => p.joinedBy).map((p) => p.joinedBy)).toEqual([t, t]);
    // Each side on its own: a change to the right leaves the left alone.
    const after = ok(resizePiece(r, t, 20));
    expect(desc(after, 'left')).toEqual(desc(r, 'left'));
  });

  it('right to left; same reference when the sides already match; only a U', () => {
    const c = setMeasurements(standardU(), { L: 120 }).config;
    const r = ok(copySide(c, 'right'));
    expect([r.L, r.R]).toEqual([132, 132]);
    const u = deepFreeze(standardU());
    expect(copySide(u, 'left')).toEqual({ config: u, rejected: null });
    const l = deepFreeze(standardL('left'));
    expect(copySide(l, 'left').rejected?.code).toBe('notAllowed');
  });
});

describe('Mirror sides (the switch on, Q71)', () => {
  const both = (c: Config) => [desc(c, 'left').join(' '), desc(c, 'right').join(' ')];

  it('a change to the left side is made to the right; to the right side, to the left; ids stay', () => {
    const u = deepFreeze(standardU());
    const l = ok(setMeasurements(u, { L: 140 }));
    const m = mirrorSides(u, l);
    expect([m.L, m.R]).toEqual([140, 140]);
    expect(both(m)[1]).toBe(both(m)[0]);
    expect(m.runs.right![0]!.id).toBe(u.runs.right![0]!.id); // the right seat keeps its id (a selection follows)
    const r = ok(setMeasurements(u, { R: 120 }));
    const n = mirrorSides(u, r);
    expect([n.L, n.R]).toEqual([120, 120]);
  });

  it('a table added to one side appears on the other; the back and other shapes are left alone', () => {
    const u = deepFreeze(standardU());
    const t = addTable(u, { run: 'right', at: 'seam', seam: 0 }).config;
    const m = mirrorSides(u, t);
    expect(desc(m, 'left')).toEqual(['table 32', 'oneArm 40=26+14@end']);
    expect(desc(m, 'right')).toEqual(desc(m, 'left'));
    valid(m);
    const d = ok(setMeasurements(u, { D: 40 }));
    expect(mirrorSides(u, d)).toBe(d);
    const l = standardL('left');
    const l2 = ok(setMeasurements(l, { L: 150 }));
    expect(mirrorSides(l, l2)).toBe(l2);
  });
});

describe('seats even around a table stay even', () => {
  it("Nick's leg 24½ | 24 | 24½: the side +10 gives 29½ | 29½ (it used to give 24½ | 34½); −10 gives 19½ | 19½", () => {
    const c = nickTable();
    const t = tableIn(c, 'left');
    expect(tableSeats(c, t)).toEqual([24.5, 24.5]);
    expect(tableSeats(ok(setMeasurements(c, { L: 150 })), t)).toEqual([29.5, 29.5]);
    expect(tableSeats(ok(setMeasurements(c, { L: 130 })), t)).toEqual([19.5, 19.5]);
  });

  it('the width and the corner keep a pair even too', () => {
    const s = centralTable(standardStraight()).config; // 14+30 | 32 | 30+14
    const t = tableIn(s, 'back');
    expect(tableSeats(ok(setMeasurements(s, { W: 131 })), t)).toEqual([35.5, 35.5]);
    const leg = nickTable(); // corner 55″
    const lt = tableIn(leg, 'left');
    for (const next of [ok(setWedge(leg, 60)), ok(resetWedge(leg)), ok(setWedge(leg, 50))]) {
      const [a, b] = tableSeats(next, lt)!;
      expect(Math.abs(a - b)).toBeLessThanOrEqual(0.5);
      expect(next.L).toBe(140);
    }
  });

  it('a pair that was uneven stays as it was (only even pairs are kept even)', () => {
    const c = nickTable();
    const t = tableIn(c, 'left');
    const uneven = ok(resizePiece(c, c.runs.left![0]!.id, 29.5)); // 29½ | 24 | 19½
    expect(tableSeats(uneven, t)).toEqual([29.5, 19.5]);
    expect(tableSeats(ok(setMeasurements(uneven, { L: 150 })), t)).toEqual([29.5, 29.5]);
  });
});

describe('the table ± grows from the middle', () => {
  const pair = () => {
    const c = centralTable(standardStraight({ W: 140 })).config; // 14+40 | 32 | 40+14 (lock on)
    return { c, t: tableIn(c, 'back') };
  };

  it('each seat gives half: +1″ takes ½″ from each side, −1″ gives ½″ back; uneven seats stay uneven', () => {
    const { c, t } = pair();
    expect(tableSeats(c, t)).toEqual([40, 40]);
    expect(tableSeats(ok(resizeTable(c, t, 33)), t)).toEqual([39.5, 39.5]);
    expect(tableSeats(ok(resizeTable(c, t, 31)), t)).toEqual([40.5, 40.5]);
    const uneven = ok(resizePiece(c, c.runs.back![0]!.id, c.runs.back![0]!.length + 6)); // 46 | 32 | 34
    expect(tableSeats(uneven, t)).toEqual([46, 34]);
    expect(tableSeats(ok(resizeTable(uneven, t, 34)), t)).toEqual([45, 33]);
    expect(ok(resizeTable(c, t, 33)).W).toBe(140);
  });

  it('16–40″; never pushes a seat under 23″ (narrowing always works); same reference when unchanged', () => {
    const { c, t } = pair();
    deepFreeze(c);
    expect(resizeTable(c, t, 41).rejected?.message).toBe('A table is 16–40″');
    expect(resizeTable(c, t, 15).config).toBe(c);
    expect(resizeTable(c, t, 32)).toEqual({ config: c, rejected: null });
    const nickC = deepFreeze(nickTable()); // 24½ | 24 | 24½
    const nt = tableIn(nickC, 'left');
    const grown = ok(resizeTable(nickC, nt, 27)); // 23 | 27 | 23
    expect(tableSeats(grown, nt)).toEqual([23, 23]);
    const r = resizeTable(grown, nt, 28);
    expect(r.config).toBe(grown);
    expect(r.rejected?.message).toBe(TABLE_SEAT_ROOM);
    expect(tableSeats(ok(resizeTable(grown, nt, 26)), nt)).toEqual([23.5, 23.5]);
  });

  it('"Sofa size changes": the sofa grows and the seats stay; a table at an end takes from its one seat', () => {
    const { c, t } = pair();
    const off = ok(resizeTable(setLock(c, false).config, t, 36));
    expect(tableSeats(off, t)).toEqual([40, 40]);
    expect(off.W).toBe(144);
    const u = standardU(); // back: table 32 by the corner | armless 36
    const ut = tableIn(u, 'back');
    const r = ok(resizeTable(u, ut, 30));
    expect(desc(r, 'back')).toEqual(['table 30', 'armless 38']);
  });
});
