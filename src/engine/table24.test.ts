// The standard table is 24″ (Andre, 2026-11-18): every new layout and every
// newly added table starts at 24″ and steps down to 20″; overall sizes stay;
// old links keep the widths they were saved with.
import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { decode, encode } from './codec';
import { blankConfig, standardL, standardStraight, standardU } from './defaults';
import { setMeasurements } from './ops';
import { TABLE_DEFAULT } from './pieces';
import { setEndCap } from './pieceOps';
import { addTable, centralTable, TABLE_STEPS } from './tablePlace';
import type { Config } from './types';

const line = (c: Config, run: 'back' | 'left' | 'right' = 'back') => (c.runs[run] ?? []).map((p) => `${p.kind} ${p.length}`);
const tables = (c: Config) => Object.values(c.runs).flat().filter((p) => p!.kind === 'table').map((p) => p!.length);

describe('the 24″ standard table (Andre, 2026-11-18)', () => {
  it('the default is 24″, stepping down to 20″ only', () => {
    expect(TABLE_DEFAULT).toBe(24);
    expect([...TABLE_STEPS]).toEqual([24, 20]);
  });

  it('the Standard U opens 60 | 24 | 44 | 60, still 188″; the L’s, the Straight and Blank open without a table, sizes unchanged', () => {
    const u = standardU();
    expect(line(u)).toEqual(['table 24', 'armless 44']);
    expect([u.W, u.L, u.R, u.D]).toEqual([188, 132, 132, 44]);
    for (const c of [standardL('left'), standardL('right'), standardStraight(), blankConfig('U')]) expect(tables(c)).toEqual([]);
    expect([standardL('left').W, standardL('right').W, standardStraight().W]).toEqual([132, 132, 120]);
  });

  it('a table added to an existing layout starts at 24″ (tray, Table in the middle, the end cap), or 20″ if 24 would leave a seat under 23″', () => {
    const s = standardStraight();
    expect(tables(centralTable(s).config)).toEqual([24]);
    expect(tables(setEndCap(s, 'back', 'table', 'start').config)).toEqual([24]);
    expect(tables(addTable(standardL('left'), { run: 'left', at: 'seam', seam: 0 }).config)).toEqual([24]);
    // A 94″ straight (two 33″ seat cushions): 24 would leave each 21″, so 20 (each keeps 23″).
    const tight = setMeasurements(standardStraight(), { W: 94 }).config;
    const r = centralTable(tight);
    expect(tables(r.config)).toEqual([20]);
  });

  it('old links keep their tables: the 32″ Standard U opens at 32″ and re-encodes byte for byte', () => {
    const old = '1UW188L132R132D44_bt32s36_la72_ra72.wh';
    const d = decode(old);
    expect('config' in d).toBe(true);
    if (!('config' in d)) return;
    expect(line(d.config)).toEqual(['table 32', 'armless 36']);
    expect(encode(d.config)).toBe(old);
    expect(encode(standardU({ table: 32 }))).toBe(old);
  });

  it('seat counts: the Standard U reads Seats 7 at 44″ (as before), 8 at 36″ (the back seat grew 52 → 60)', () => {
    const at = (D: number) => buildHaven(setMeasurements(standardU(), { D }).config).seats;
    expect(at(44).comfortable).toBe(7);
    expect(at(36).comfortable).toBe(8);
  });
});
