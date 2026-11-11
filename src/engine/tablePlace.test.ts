// Where a new table goes (Andre, 2026-11-09): between cushions, both seats
// shrinking equally; 32″ first, stepping down to 28, 24, 20 so no seat goes
// under 23″; "Not enough seat for a table here." when none fits; the tray's
// one-tap puts it at the most central seam. Old layouts load as they were.
import { describe, expect, it } from 'vitest';
import { decodeLayout, encodeLayout } from './codecLayout';
import { standardStraight, standardU } from './defaults';
import { solo } from './layoutOps';
import { setArmWidth } from './ops';
import { cushionOf, isSeat } from './pieces';
import { addPiece } from './pieceOps';
import { anchoredTargets, moveTable } from './tableOps';
import { addTable, centralTable, NO_TABLE_ROOM, tableFits, tableTargets, touchingTables } from './tablePlace';
import { deepFreeze, desc, valid } from './testing';
import type { Config } from './types';

const straight10 = () => setArmWidth(standardStraight(), 10).config; // 10+50 | 50+10
const tableOf = (c: Config) => c.runs.back!.find((p) => p.kind === 'table')!;
const seatsUnder23 = (c: Config) =>
  Object.values(c.runs).flatMap((ps) => ps!.filter((p) => isSeat(p) && cushionOf(p, c.dims.A) < 23));

describe('a table between two seats', () => {
  it("Andre's straight 120″ (10 | 50 | 50 | 10) + a table: 10 | 34 | 32 | 34 | 10, not 10 | 18 | 32 | 50 | 10", () => {
    const c = deepFreeze(straight10());
    expect(desc(c, 'back')).toEqual(['oneArm 60=50+10@start', 'oneArm 60=50+10@end']);
    const r = addPiece(c, 'table', { run: 'back', at: 'seam', seam: 1 });
    expect(r.rejected).toBeNull();
    valid(r.config);
    expect(desc(r.config, 'back')).toEqual(['oneArm 44=34+10@start', 'table 32', 'oneArm 44=34+10@end']);
    expect(r.config.W).toBe(120);
  });

  it('with the default 14″ arms: 14 | 30 | 32 | 30 | 14', () => {
    const r = addPiece(standardStraight(), 'table', { run: 'back', at: 'seam', seam: 1 });
    expect(desc(r.config, 'back')).toEqual(['oneArm 44=30+14@start', 'table 32', 'oneArm 44=30+14@end']);
  });

  it('"Sofa size changes" (lock off): the seats keep their size and the sofa grows by the table', () => {
    const c = { ...straight10(), lockOutside: false };
    const r = addPiece(c, 'table', { run: 'back', at: 'seam', seam: 1 });
    valid(r.config);
    expect(desc(r.config, 'back')).toEqual(['oneArm 60=50+10@start', 'table 32', 'oneArm 60=50+10@end']);
    expect(r.config.W).toBe(152);
  });

  it('next to a corner or an end, the seat on the other side takes it (as before)', () => {
    const r = addPiece(standardU(), 'table', { run: 'left', at: 'seam', seam: 0 });
    expect(desc(r.config, 'left')).toEqual(['table 32', 'oneArm 40=26+14@end']);
    // Outside the end arm: the end seat takes it all; 32 and 28 would leave it under 23, so 24.
    const end = addPiece(straight10(), 'table', { run: 'back', at: 'seam', seam: 2 });
    expect(desc(end.config, 'back')).toEqual(['oneArm 60=50+10@start', 'oneArm 36=26+10@end', 'table 24']);
  });
});

describe('the width steps down so no seat goes under 23″', () => {
  it('two 38″ seats: 32 would leave 22, so 28: 24 | 28 | 24', () => {
    const c = standardStraight({ W: 104 }); // 14+38 | 38+14
    expect(desc(c, 'back')).toEqual(['oneArm 52=38+14@start', 'oneArm 52=38+14@end']);
    const r = addTable(c, { run: 'back', at: 'seam', seam: 1 });
    valid(r.config);
    expect(desc(r.config, 'back')).toEqual(['oneArm 38=24+14@start', 'table 28', 'oneArm 38=24+14@end']);
  });

  it('none fits: refused in plain words, same reference', () => {
    const u = deepFreeze(standardU()); // back: table 32 | armless 36
    const r = addTable(u, { run: 'back', at: 'seam', seam: 2 });
    expect(r.config).toBe(u);
    expect(r.rejected?.message).toBe(NO_TABLE_ROOM);
    expect(NO_TABLE_ROOM).toBe('Not enough seat for a table here.');
  });

  it('tableFits: a seat it shrinks under 23 fails; seats already narrow and not shrunk are fine', () => {
    const c = standardStraight({ W: 104 });
    const r = addPiece(c, 'table', { run: 'back', at: 'seam', seam: 1 }, { length: 32 }); // explicit: 22 | 32 | 22
    expect(tableFits(c, r.config)).toBe(false);
    expect(tableFits(r.config, r.config)).toBe(true);
  });
});

describe('where the tray offers a new table', () => {
  it('the Standard U: the corner seam and the arm\'s place on each leg (never outside the arm, Q72); no split (halves under 23); none on its full back', () => {
    const t = tableTargets(standardU());
    expect(t.map((x) => `${x.placement.run} ${x.placement.at}`)).toEqual(['left seam', 'left replaceArm', 'right seam', 'right replaceArm']);
    const end = t.find((x) => x.placement.run === 'left' && x.placement.at === 'replaceArm')!;
    expect(desc(end.config, 'left')).toEqual(['armless 40', 'table 32']); // seat | table: the arm's place
    for (const x of t) expect(seatsUnder23(x.config)).toEqual([]);
  });

  it('never right next to another table (Phase 3c round 2): a second table goes elsewhere or is refused', () => {
    const long = standardU({ L: 150, R: 150 });
    const first = addTable(long, { run: 'left', at: 'seam', seam: 0 }).config; // table 32 | seat at the corner
    for (const t of tableTargets(first)) expect(touchingTables(t.config), JSON.stringify(t.placement)).toBe(0);
    const leftTable = first.runs.left!.find((p) => p.kind === 'table')!;
    for (const a of anchoredTargets(first, leftTable.id)) expect(touchingTables(moveTable(first, leftTable.id, a.placement).config)).toBe(0);
  });

  it('the middle of a seat, when both halves stay 23″ or more (Q73)', () => {
    // A one-seat leg of 73″ cushion: a 24″ table in its middle leaves 24½ | 24½.
    const nick = standardU({ W: 170, L: 140, R: 140, wedgeC: 55, dims: { A: 12 } });
    const split = tableTargets(nick).find((x) => x.placement.run === 'left' && x.placement.at === 'split')!;
    expect(desc(split.config, 'left')).toEqual(['armless 24.5', 'table 24', 'oneArm 36.5=24.5+12@end']);
    // A 104″ side seat (L 164): 32 in the middle, 29 | 29.
    const long = standardU({ L: 164 });
    const mid = tableTargets(long).find((x) => x.placement.run === 'left' && x.placement.at === 'split')!;
    expect(desc(mid.config, 'left')).toEqual(['armless 29', 'table 32', 'oneArm 43=29+14@end']);
  });

  it('"Table in the middle": the straight sofa gets 10 | 34 | 32 | 34 | 10; the Standard U a leg at its corner', () => {
    const s = centralTable(straight10());
    expect(s.rejected).toBeNull();
    expect(desc(s.config, 'back')).toEqual(['oneArm 44=34+10@start', 'table 32', 'oneArm 44=34+10@end']);
    const u = centralTable(standardU());
    expect(u.placement).toEqual({ run: 'left', at: 'seam', seam: 0 });
    expect(desc(u.config, 'left')).toEqual(['table 32', 'oneArm 40=26+14@end']);
  });

  it('no place at all: refused', () => {
    const tight = standardStraight({ W: 72 }); // 14+22 | 22+14: no table leaves both at 23
    const r = centralTable(tight);
    expect(r.config).toBe(tight);
    expect(r.rejected?.message).toBe(NO_TABLE_ROOM);
  });
});

describe('moving a table and old layouts', () => {
  it('a moved table keeps its width, and no offered spot leaves a seat it shrinks under 23″', () => {
    const c = addPiece(straight10(), 'table', { run: 'back', at: 'seam', seam: 1 }).config;
    const id = tableOf(c).id;
    for (const t of anchoredTargets(c, id)) {
      const r = moveTable(c, id, t.placement);
      expect(tableOf(r.config).length).toBe(32);
      expect(tableFits(c, r.config)).toBe(true);
    }
  });

  it('the Standard U and old links load exactly as they were', () => {
    const u = standardU();
    expect(desc(u, 'back')).toEqual(['table 32', 'armless 36']);
    const link = '1UW188L132R132D44_bt32s36_la72_ra72.wh';
    const d = decodeLayout(link);
    expect('layout' in d && encodeLayout(d.layout)).toBe(link);
    expect('layout' in d && desc(d.layout.sections[0]!.config, 'back')).toEqual(['table 32', 'armless 36']);
    expect(encodeLayout(solo(u))).toBe(link);
  });
});
