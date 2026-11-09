// The straight sofa (Andre, 2026-11-06; plan §10 "Straight sofa"): one run, the
// back, open at both ends, no wedges. Link v4 (shape `i`); every older link is
// unchanged.
import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { checksum, decode, encode, LINK_VERSION } from './codec';
import { decodeLayout, encodeLayout } from './codecLayout';
import { blankConfig, standardStraight, standardU } from './defaults';
import { solo } from './layoutOps';
import { setArmWidth, setMeasurements, setWedge } from './ops';
import { addPiece, convertPiece, deletePiece, fillGap, setEndCap } from './pieceOps';
import { setShape } from './shape';
import { anchoredTargets, moveTable } from './tableOps';
import { tableSeats } from './balance';
import { canon, deepFreeze, desc, valid } from './testing';
import type { Config } from './types';

/** Golden v4 links: kept forever. */
const GOLDEN_V4: Record<string, string> = {
  standard: '4iW120L44R44D44_ba60Sa60E.bl',
  midTable: '4iW212L44R44D44_ba63Ss33jt20s33ja63E.ud',
  endTable: '4iW150L44R44D44_bt32s43a75E.6j',
};

/** Andre's site photo: arm | seat | seat | table | seat | seat | arm, as one-arm 63 | 33 | table 20 | 33 | one-arm 63 (W 212). */
function photo(): Config {
  const c = standardStraight({ W: 212 });
  const back: Config['runs']['back'] = [
    { id: 'p1', kind: 'oneArm', length: 63, arm: 'start' },
    { id: 'p3', kind: 'armless', length: 33, joinedBy: 'p4' },
    { id: 'p4', kind: 'table', length: 20 },
    { id: 'p5', kind: 'armless', length: 33, joinedBy: 'p4' },
    { id: 'p2', kind: 'oneArm', length: 63, arm: 'end' },
  ];
  return { ...c, runs: { back }, nextId: 6 };
}

describe('straight sofa: the shape', () => {
  it('standard: W 120, two one-arm 60s, arms out, no wedges, Seats 3, no warnings', () => {
    const c = deepFreeze(standardStraight());
    const b = valid(c);
    expect(c.shape).toBe('straight');
    expect(desc(c, 'back')).toEqual(['oneArm 60=46+14@start', 'oneArm 60=46+14@end']);
    expect(b.pieces.filter((p) => p.kind === 'wedge')).toHaveLength(0);
    expect(b.seats.label).toBe('Seats 3');
    expect(b.warnings).toEqual([]);
    expect([b.bounds.minX, b.bounds.minY, b.bounds.maxX, b.bounds.maxY]).toEqual([0, 0, 120, 44]);
    expect(b.runs[0]!.openEnds).toEqual(['start', 'end']);
    expect(b.runs[0]!.endCaps).toEqual({ start: 'arm', end: 'arm' });
  });

  it('a long straight splits past 108 per piece; arms still at both ends', () => {
    const c = standardStraight({ W: 240 });
    valid(c);
    expect(desc(c, 'back').map((d) => d.split(' ')[0])).toEqual(['oneArm', 'armless', 'oneArm']);
  });

  it('width changes share both ends; the lock holds W for piece edits', () => {
    const c = standardStraight();
    const r = setMeasurements(c, { W: 131 });
    valid(r.config);
    expect(desc(r.config, 'back')).toEqual(['oneArm 65.5=51.5+14@start', 'oneArm 65.5=51.5+14@end']);
    expect(setMeasurements(c, { L: 100 }).config.L).toBe(44);
  });

  it('no corner: the wedge slider is refused (same reference); the shape converts in place (3c)', () => {
    const c = standardStraight();
    expect(setWedge(c, 70).config).toBe(c);
    expect(setShape(c, 'U').config.shape).toBe('U');
    expect(setShape(standardU(), 'straight').config.shape).toBe('straight');
  });
});

describe('straight sofa: ends', () => {
  it('a table can replace either arm; the other end keeps its arm', () => {
    const c = standardStraight({ W: 150 });
    const s = setEndCap(c, 'back', 'table', 'start');
    valid(s.config);
    expect(desc(s.config, 'back')).toEqual(['table 32', 'armless 43', 'oneArm 75=61+14@end']);
    expect(buildHaven(s.config).runs[0]!.endCaps).toEqual({ start: 'table', end: 'arm' });
    const e = setEndCap(s.config, 'back', 'open', 'end');
    expect(buildHaven(e.config).runs[0]!.endCaps).toEqual({ start: 'table', end: 'open' });
    const back = setEndCap(e.config, 'back', 'arm', 'end');
    expect(buildHaven(back.config).runs[0]!.endCaps.end).toBe('arm');
  });

  it('an arm goes on the end a seat sits at; delete and fill keep both ends right', () => {
    const c = setEndCap(standardStraight(), 'back', 'open', 'start').config;
    const first = c.runs.back![0]!;
    const r = convertPiece(c, first.id);
    valid(r.config);
    expect(r.config.runs.back![0]!.arm).toBe('start');
    const blank = blankConfig('straight', { W: 100, L: 44, R: 44 });
    valid(blank);
    const g = fillGap(blank, blank.runs.back![0]!.id, 'oneArm');
    valid(g.config);
    expect(g.config.runs.back![0]!.arm).toBe('end');
    expect(deletePiece(c, first.id).rejected).toBeNull();
  });

  it('table drag targets include both arms (replace) and outside both arms', () => {
    const c = addPiece(standardStraight({ W: 150 }), 'table', { run: 'back', at: 'seam', seam: 1 }).config;
    const id = c.runs.back!.find((p) => p.kind === 'table')!.id;
    const t = anchoredTargets(c, id).map((x) => x.placement);
    expect(t).toContainEqual({ run: 'back', at: 'replaceArm', end: 'start' });
    expect(t).toContainEqual({ run: 'back', at: 'replaceArm', end: 'end' });
    const out = moveTable(c, id, { run: 'back', at: 'seam', seam: 0 });
    valid(out.config);
    expect(buildHaven(out.config).runs[0]!.endCaps.start).toBe('armTable');
  });
});

describe('straight sofa: balance and arms', () => {
  it('a table dropped into a one-arm seat: 20″, seats even', () => {
    const c = standardStraight({ W: 160 }); // 80 | 80 (66 cushions)
    const r = addPiece(c, 'table', { run: 'back', at: 'split', pieceId: c.runs.back![1]!.id });
    valid(r.config);
    const id = r.config.runs.back!.find((p) => p.kind === 'table')!.id;
    expect(tableSeats(r.config, id)).toEqual([23, 23]);
  });

  it('arm width 14 → 10 keeps W; both arms change', () => {
    const r = setArmWidth(standardStraight(), 10);
    valid(r.config);
    expect(desc(r.config, 'back')).toEqual(['oneArm 60=50+10@start', 'oneArm 60=50+10@end']);
  });
});

describe('link v4', () => {
  it('the goldens decode and re-encode exactly', () => {
    expect(LINK_VERSION).toBe(6); // v5 added the room (H6c), v6 the snug count; v4 straight links are unchanged
    const made: Record<string, Config> = { standard: standardStraight(), midTable: photo(), endTable: setEndCap(standardStraight({ W: 150 }), 'back', 'table', 'start').config };
    for (const [name, c] of Object.entries(made)) {
      valid(c);
      expect(encode(c), name).toBe(GOLDEN_V4[name]);
      expect(encodeLayout(solo(c)), name).toBe(GOLDEN_V4[name]);
      const d = decode(GOLDEN_V4[name]!);
      expect('config' in d && canon(d.config), name).toEqual(canon(c));
      const l = decodeLayout(GOLDEN_V4[name]!);
      expect('layout' in l && l.layout.sections.length, name).toBe(1);
    }
  });

  it("Andre's site photo lays out: 212 × 44, seats 33 | 33 either side of the table, Seats 4–6", () => {
    const b = valid(photo());
    expect([b.bounds.maxX, b.bounds.maxY]).toEqual([212, 44]);
    expect(tableSeats(photo(), 'p4')).toEqual([33, 33]);
    expect([b.seats.label, b.seats.snug]).toEqual(['Seats 4', 6]);
  });

  it('shape i in a v1–v3 link is damaged; a v7 link is newer', () => {
    const body = GOLDEN_V4.standard!.slice(1, -3);
    for (const v of [1, 2, 3]) expect(decode(`${v}${body}.${checksum(`${v}${body}`)}`)).toEqual({ error: 'damaged' });
    expect(decode(`7${GOLDEN_V4.standard!.slice(1)}`)).toEqual({ error: 'newer' });
  });
});
