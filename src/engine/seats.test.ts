// One seat number everywhere (Andre, 2026-11-09): "Seats 7" (28″), "Seats 8 ·
// snug" (24″) or "Seats 9 · 21″ seats"; Snug travels with the layout (link v6,
// every older link byte for byte); the numbered markers come from the same
// count, so they always agree with it.
import { describe, expect, it } from 'vitest';
import { checksum } from './codec';
import { decodeLayout, encodeLayout } from './codecLayout';
import { blankConfig, standardL, standardStraight, standardU } from './defaults';
import { buildLayout } from './layoutBuild';
import { setSnug, solo } from './layoutOps';
import type { Layout } from './layoutTypes';
import { setMeasurements, setSeatWidth } from './ops';
import { setRoom } from './room';
import { layoutSeatMarkers, seatMarkers } from './seatMarkers';
import { seatsIn, seatsLabel } from './seating';
import { addTable, centralTable, tableTargets } from './tablePlace';
import { teeLayout } from './tee';
import { buildHaven } from './buildHaven';
import { deepFreeze, desc } from './testing';
import type { Config } from './types';

const mode = (l: Layout) => ({ snug: !!l.snug, seatWidth: l.sections[0]!.config.seatWidth, snugWidth: l.sections[0]!.config.snugWidth });
const markers = (l: Layout) => layoutSeatMarkers(buildLayout(l).sections, mode(l));

describe('the seat label', () => {
  it('comfortable, snug, and a width that is not the standard one', () => {
    const w = { seatWidth: 28, snugWidth: 24 };
    expect(seatsLabel(7, { snug: false, ...w })).toBe('Seats 7');
    expect(seatsLabel(8, { snug: true, ...w })).toBe('Seats 8 · snug');
    expect(seatsLabel(9, { snug: false, seatWidth: 21, snugWidth: 24 })).toBe('Seats 9 · 21″ seats');
    expect(seatsLabel(10, { snug: true, seatWidth: 28, snugWidth: 22 })).toBe('Seats 10 · 22″ seats');
    expect(seatsLabel(9, { snug: true, seatWidth: 21, snugWidth: 24 })).toBe('Seats 9 · 21″ seats'); // snug can't be wider than a seat
    expect(seatsLabel(5, { snug: false, seatWidth: 26.5, snugWidth: 24 })).toBe('Seats 5 · 26.5″ seats');
  });

  it('a seat of 23″ or more seats one even when narrower than 28″ (Q76); longer stretches one per width', () => {
    expect([23, 22.5, 27.5, 50, 56].map((len) => seatsIn(len, 28))).toEqual([1, 0, 1, 1, 2]);
    expect([22, 23, 46, 48].map((len) => seatsIn(len, 24))).toEqual([0, 1, 1, 2]);
    // Andre's sofa: 152″ sides, a 32″ table in the middle of each (23 | 32 | 23): 7 seats, a marker on each.
    const split = tableTargets(standardU({ L: 152, R: 152 })).filter((t) => t.placement.at === 'split' && t.placement.run === 'left')[0]!;
    expect(desc(split.config, 'left')).toEqual(['armless 23', 'table 32', 'oneArm 37=23+14@end']);
    const l = solo(split.config);
    expect(buildLayout(l).seats.count).toBe(markers(l).length);
  });

  it('the layout picks the number: the Standard U at 36″ deep is 7 comfortable, 8 snug', () => {
    const l = deepFreeze(solo(setMeasurements(standardU(), { D: 36 }).config));
    expect(buildLayout(l).seats).toMatchObject({ comfortable: 7, snug: 8, count: 7, label: 'Seats 7' });
    const s = setSnug(l, true).layout;
    expect(buildLayout(s).seats).toMatchObject({ count: 8, label: 'Seats 8 · snug' });
  });
});

describe('Snug on the layout', () => {
  it('setSnug: same reference when unchanged; off leaves no key', () => {
    const l = deepFreeze(solo(standardU()));
    expect(setSnug(l, false).layout).toBe(l);
    const on = setSnug(l, true).layout;
    expect(on.snug).toBe(true);
    expect(setSnug(on, true).layout).toBe(on);
    const off = setSnug(on, false).layout;
    expect('snug' in off).toBe(false);
  });

  it('link v6: a last N token only when snug; every older link byte for byte', () => {
    const cases: [string, Layout][] = [
      ['U', solo(standardU())],
      ['straight', solo(standardStraight())],
      ['U + room', setRoom(solo(standardU()), { w: 240, d: 200 }).layout],
      ['T', teeLayout({ total: 229, stem: 110 })],
    ];
    for (const [name, l] of cases) {
      const plain = encodeLayout(l);
      expect(plain.startsWith('6'), name).toBe(false);
      const snug = encodeLayout(setSnug(l, true).layout);
      expect(snug, name).toMatch(/^6.*_N\.[0-9a-z]{2}$/);
      const d = decodeLayout(snug);
      expect('layout' in d && d.layout.snug, name).toBe(true);
      expect('layout' in d && encodeLayout(d.layout), name).toBe(snug);
      const p = decodeLayout(plain);
      expect('layout' in p && 'snug' in p.layout, name).toBe(false);
    }
  });

  it('golden v6 links (kept forever)', () => {
    const GOLDEN_V6: Record<string, string> = {
      uSnug: encodeLayout(setSnug(solo(standardU()), true).layout),
      straightRoomSnug: encodeLayout(setSnug(setRoom(solo(standardStraight()), { w: 200, d: 150 }).layout, true).layout),
    };
    expect(GOLDEN_V6).toEqual({
      uSnug: '6UW188L132R132D44_bt32s36_la72_ra72_N.m1',
      straightRoomSnug: '6iW120L44R44D44_ba60Sa60E_Mw200d150_N.pt',
    });
  });

  it('an N token in an older link is damaged; a v7 link is newer', () => {
    const body = 'UW188L132R132D44_bt32s36_la72_ra72_N';
    expect(decodeLayout(`5${body}.${checksum(`5${body}`)}`)).toEqual({ error: 'damaged' });
    expect(decodeLayout(`7${body}.${checksum(`7${body}`)}`)).toEqual({ error: 'newer' });
  });
});

describe('the markers agree with the count', () => {
  const configs: Config[] = [];
  for (const D of [36, 40, 44]) for (const W of [140, 188, 240, 300]) configs.push(setMeasurements(standardU(), { D, W }).config);
  configs.push(standardL('left'), standardL('right', { W: 120, R: 100 }), standardStraight(), standardStraight({ W: 212 }), blankConfig('U'));
  for (const c of [...configs]) {
    const t = centralTable(c);
    if (!t.rejected) configs.push(t.config);
    const t2 = addTable(c, { run: 'back', at: 'seam', seam: 0 });
    if (!t2.rejected) configs.push(t2.config);
  }
  // Q76: seats of 23–27″ either side of a table in the middle of a side (Andre's 152″ sides: 23 | 32 | 23).
  for (const L of [140, 148, 152, 156]) {
    for (const t of tableTargets(standardU({ L, R: L }))) if (t.placement.at === 'split') configs.push(t.config);
  }
  for (const c of [...configs]) for (const w of [21, 24, 30]) configs.push(setSeatWidth(c, w).config);

  it(`every layout (${configs.length}), comfortable and snug: as many markers as "Seats N"`, () => {
    for (const c of configs) {
      for (const snug of [false, true]) {
        const l = setSnug(solo(c), snug).layout;
        expect(markers(l).length, `${c.shape} W${c.W} D${c.D} seat ${c.seatWidth} snug ${snug}`).toBe(buildLayout(l).seats.count);
      }
    }
  });

  it('a T: both halves, numbered on', () => {
    const t = teeLayout({ total: 229, stem: 110 });
    for (const snug of [false, true]) {
      const l = setSnug(t, snug).layout;
      expect(markers(l).length).toBe(buildLayout(l).seats.count);
    }
  });

  it('the Standard U, in order round the sofa: left leg from its end, left corner, back, right corner, right leg', () => {
    const b = buildHaven(standardU());
    const m = seatMarkers(b, { snug: false, seatWidth: 28, snugWidth: 24 });
    expect(m).toHaveLength(7);
    const [l1, l2, w1, back, w2, r1, r2] = m as [[number, number], [number, number], [number, number], [number, number], [number, number], [number, number], [number, number]];
    expect(l1[1]).toBeGreaterThan(l2[1]); // up the left leg toward the corner
    expect(Math.abs(l1[0] - l2[0])).toBeLessThan(1e-9);
    expect(w1[0]).toBeLessThan(60);
    expect(w1[1]).toBeLessThan(60);
    expect(back[0]).toBeGreaterThan(92); // on the 36″ seat, right of the table
    expect(back[0]).toBeLessThan(128);
    expect(w2[0]).toBeGreaterThan(128);
    expect(r1[1]).toBeLessThan(r2[1]); // down the right leg to its end
  });

  it('a straight sofa: three in a row, evenly spread over the cushions; a table breaks the stretch', () => {
    const b = buildHaven(standardStraight()); // 14+46 | 46+14
    const m = seatMarkers(b, { snug: false, seatWidth: 28, snugWidth: 24 });
    expect(m.map(([x]) => +x.toFixed(2))).toEqual([29.33, 60, 90.67]);
    const t = centralTable(standardStraight()).config; // 14+30 | 32 | 30+14
    expect(seatMarkers(buildHaven(t), { snug: false, seatWidth: 28, snugWidth: 24 }).map(([x]) => x)).toEqual([29, 91]);
  });
});
