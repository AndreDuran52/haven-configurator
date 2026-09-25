import { describe, expect, it } from 'vitest';
import { blankConfig, standardL, standardU } from './defaults';
import { available } from './layout';
import { backLine, codes, deepFreeze, desc, idAt, op, piece, runOf, tableId, test3b, U, valid } from './testing';

// §12 engine tests, with the assertions plan §11 adds (fixture: Standard U =
// W188 L132 R132 D44, C auto 60, A14, B10, lock on, seat width 28, snug 24).

describe('§12 spec tests', () => {
  it('T1 Standard U: back [wedge 60][table 32][armless 36][wedge 60], legs one-arm 72, Seats 7', () => {
    const c = U();
    const b = valid(c);
    expect([b.W, b.L, b.R, b.D, b.wedge.C]).toEqual([188, 132, 132, 44, 60]);
    expect(backLine(b)).toEqual(['wedge 60', 'table 32', 'armless 36', 'wedge 60']);
    expect(desc(c, 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(desc(c, 'right')).toEqual(['oneArm 72=58+14@end']);
    expect(piece(b, idAt(c, 'left', 0)).arm!.facing).toBe('LAF');
    expect(piece(b, idAt(c, 'right', 0)).arm!.facing).toBe('RAF');
    expect(b.seatDepth).toBe(34);
    expect(b.opening).toEqual({ width: 100, depth: 88 });
    expect(b.seats.label).toBe('Seats 7');
    expect(b.warnings).toEqual([]);
    expect(b.exportBlocked).toBe(false);
    expect(piece(b, 'wedge:backLeft').polygon).toEqual([[0, 0], [60, 0], [60, 44], [44, 60], [0, 60]]);
    expect(piece(b, 'wedge:backRight').polygon).toEqual([[188, 0], [188, 60], [144, 60], [128, 44], [128, 0]]);
  });

  it('T1 (geometry) exact §8 coordinates: rects, arms, backs, cushions, bounds, heights', () => {
    const c = U();
    const b = valid(c);
    expect(piece(b, 'wedge:backLeft').backs).toEqual([{ x: 0, y: 0, w: 60, h: 10 }, { x: 0, y: 0, w: 10, h: 60 }]);
    expect(piece(b, tableId(c)).bbox).toEqual({ x: 60, y: 0, w: 32, h: 44 });
    expect(piece(b, idAt(c, 'back', 1)).bbox).toEqual({ x: 92, y: 0, w: 36, h: 44 });
    const left = piece(b, idAt(c, 'left', 0));
    expect(left.bbox).toEqual({ x: 0, y: 60, w: 44, h: 72 });
    expect(left.arm).toEqual({ at: 'end', facing: 'LAF', rect: { x: 0, y: 118, w: 44, h: 14 } });
    expect(left.backs).toEqual([{ x: 0, y: 60, w: 10, h: 58 }]);
    expect(left.cushionRect).toEqual({ x: 10, y: 60, w: 34, h: 58 });
    const right = piece(b, idAt(c, 'right', 0));
    expect(right.arm).toEqual({ at: 'end', facing: 'RAF', rect: { x: 144, y: 118, w: 44, h: 14 } });
    expect(right.cushionRect).toEqual({ x: 144, y: 60, w: 34, h: 58 });
    expect(b.runs.map((r) => [r.id, r.endCap])).toEqual([['back', null], ['left', 'arm'], ['right', 'arm']]);
    expect(b.wedge.readout).toBe('Wedge 60 × 60 · angled face 22.6"');
    expect(b.bounds).toEqual({ minX: 0, minY: 0, maxX: 188, maxY: 132 }); // G4
    expect(b.heights).toMatchObject({ legHeight: 1, seatHeight: 18, armHeight: 23, backHeight: 27, tableHeight: 23 });
  });

  it('T2 D = 36: C 52 (auto); back [32][52]; legs 80 (66 + 14); seat depth 26; opening 116 × 96; Seats 7–8', () => {
    for (const c of [op.setMeasurements(U(), { D: 36 }), standardU({ D: 36 })]) {
      const b = valid(c);
      expect(b.wedge).toMatchObject({ C: 52, auto: true });
      expect(desc(c, 'back')).toEqual(['table 32', 'armless 52']);
      expect(desc(c, 'left')).toEqual(['oneArm 80=66+14@end']);
      expect(desc(c, 'right')).toEqual(['oneArm 80=66+14@end']);
      expect(b.seatDepth).toBe(26);
      expect([b.W, b.L, b.R]).toEqual([188, 132, 132]);
      expect(b.opening).toEqual({ width: 116, depth: 96 });
      expect(b.seats.label).toBe('Seats 7–8');
    }
  });

  it('T3a table to the end of the left leg in place of the arm: left [armless 40][table 32], back [armless 68], Seats 7', () => {
    const c0 = U();
    const c = op.moveTable(c0, tableId(c0), { run: 'left', at: 'replaceArm' });
    expect(desc(c, 'left')).toEqual(['armless 40', 'table 32']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    const b = valid(c);
    expect(runOf(b, 'left').endCap).toBe('table');
    expect(c.runs.left![1]!.id).toBe(tableId(c0)); // the same table moved
    expect(b.seats.label).toBe('Seats 7');
  });

  it('T3b table to the middle of the left leg: [armless 13][table 32][one-arm 27 = 13 + 14], Seats 6', () => {
    const c = test3b();
    expect(desc(c, 'left')).toEqual(['armless 13', 'table 32', 'oneArm 27=13+14@end']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    const b = valid(c);
    const under = b.warnings.filter((w) => w.code === 'seatUnder20');
    // Both 13" cushions warn, including the one-arm piece whose FOOTPRINT is 27".
    expect(under.map((w) => w.pieceId)).toEqual([idAt(c, 'left', 0), idAt(c, 'left', 2)]);
    expect(b.seats.label).toBe('Seats 6');
    expect(b.exportBlocked).toBe(false); // warnings never block
  });

  it('T4 standardL(right, W120 R100) at D 44: back one-arm 60 (46 + 14) arm at start LAF, leg one-arm 40, Seats 2–3', () => {
    const c = standardL('right', { W: 120, R: 100 });
    const b = valid(c);
    expect(b.wedge.C).toBe(60);
    expect(desc(c, 'back')).toEqual(['oneArm 60=46+14@start']);
    expect(desc(c, 'right')).toEqual(['oneArm 40=26+14@end']);
    expect(c.runs.left).toBeUndefined();
    expect(piece(b, idAt(c, 'back', 0)).arm).toEqual({ at: 'start', facing: 'LAF', rect: { x: 0, y: 0, w: 14, h: 44 } });
    expect(piece(b, idAt(c, 'right', 0)).bbox).toEqual({ x: 76, y: 60, w: 44, h: 40 });
    expect(backLine(b)).toEqual(['oneArm 60', 'wedge 60']);
    expect(b.opening).toBeNull();
    expect(b.seats.label).toBe('Seats 2–3');
  });

  it('T5 W = 300: back [table 32][74][74] (one split group), legs 72, Seats 11–12', () => {
    for (const c of [standardU({ W: 300 }), op.setMeasurements(U(), { W: 300 })]) {
      expect(desc(c, 'back')).toEqual(['table 32', 'armless 74', 'armless 74']);
      const [, a, b] = c.runs.back!;
      expect(a!.splitGroup).toBeDefined();
      expect(a!.splitGroup).toBe(b!.splitGroup);
      expect(desc(c, 'left')).toEqual(['oneArm 72=58+14@end']);
      const built = valid(c);
      expect(built.W).toBe(300);
      expect(built.seats.label).toBe('Seats 11–12');
    }
  });

  it('T6 setWedge(55): legs 77 (63 + 14), back [32][46], W/L/R unchanged, face 15.6, Seats 7', () => {
    const c = op.setWedge(U(), 55);
    const b = valid(c);
    expect(b.wedge).toMatchObject({ C: 55, auto: false });
    expect(desc(c, 'left')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(c, 'right')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 46']);
    expect([b.W, b.L, b.R]).toEqual([188, 132, 132]);
    expect(b.wedge.face.toFixed(1)).toBe('15.6');
    expect(b.seats.label).toBe('Seats 7');
  });

  it('T7 setEndCap(right, open): right [armless 72], Seats 7–8', () => {
    const c = op.setEndCap(U(), 'right', 'open');
    expect(desc(c, 'right')).toEqual(['armless 72']);
    const b = valid(c);
    expect(runOf(b, 'right').endCap).toBe('open');
    expect(b.seats.label).toBe('Seats 7–8');
  });

  it('T8 blankConfig(U) at D 44, C 60: gaps 68 / 72 / 72, no arms, export blocked, Seats 2', () => {
    const c = deepFreeze(blankConfig('U', { W: 188, L: 132, R: 132 }));
    const b = valid(c);
    expect(b.pieces.map((p) => p.kind)).toEqual(['wedge', 'wedge']);
    expect(b.gaps.map((g) => [g.run, g.length, g.label])).toEqual([
      ['back', 68, 'unfilled 68"'],
      ['left', 72, 'unfilled 72"'],
      ['right', 72, 'unfilled 72"'],
    ]);
    expect(b.exportBlocked).toBe(true);
    expect(b.seats.label).toBe('Seats 2');
  });

  it('T9 the invariant holds on every §12 case, plus a blank U at W 300 (one 180" back gap)', () => {
    const u = U();
    const cases = [
      u,
      op.setMeasurements(u, { D: 36 }),
      op.moveTable(u, tableId(u), { run: 'left', at: 'replaceArm' }),
      test3b(),
      standardL('right', { W: 120, R: 100 }),
      standardU({ W: 300 }),
      op.setWedge(u, 55),
      op.setEndCap(u, 'right', 'open'),
      blankConfig('U'),
      blankConfig('U', { W: 300 }),
    ];
    for (const c of cases) {
      valid(c);
      for (const r of Object.keys(c.runs) as (keyof typeof c.runs)[]) {
        expect(c.runs[r]!.reduce((s, p) => s + p.length, 0)).toBe(available(c, r));
      }
    }
    expect(desc(cases[9]!, 'back')).toEqual(['gap 180']);
    expect(codes(valid(u))).toEqual([]);
  });
});
