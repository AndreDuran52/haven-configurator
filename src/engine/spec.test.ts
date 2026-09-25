import { describe, expect, it } from 'vitest';
import { blankConfig, standardL, standardU } from './defaults';
import { available } from './layout';
import { deepFreeze, valid, op, U, desc, idAt, tableId, piece, backLine } from './testing';

// ---------------------------------------------------------------------------
// §12 engine tests, exactly as written

describe('§12 spec tests', () => {
  it('1. Standard U: back [wedge 60][table 32][armless 36][wedge 60] = 188, legs one-arm 72, depth 34, opening 100x88, Seats 7', () => {
    const c = U();
    const b = valid(c);
    expect([b.W, b.L, b.R, b.D, b.wedge.C]).toEqual([188, 132, 132, 44, 60]);
    expect(backLine(b)).toEqual(['wedge 60', 'table 32', 'armless 36', 'wedge 60']);
    expect(desc(c, 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(desc(c, 'right')).toEqual(['oneArm 72=58+14@end']);
    expect(b.seatDepth).toBe(34);
    expect(b.opening).toEqual({ width: 100, depth: 88 });
    expect(b.seats.label).toBe('Seats 7');
    expect(b.warnings).toEqual([]);
    expect(b.exportBlocked).toBe(false);
  });

  it('1. (geometry) exact §8 coordinates: wedge polygons, rects, arms, backs, cushions', () => {
    const c = U();
    const b = valid(c);
    expect(piece(b, 'wedge:backLeft').polygon).toEqual([[0, 0], [60, 0], [60, 44], [44, 60], [0, 60]]);
    expect(piece(b, 'wedge:backRight').polygon).toEqual([[188, 0], [188, 60], [144, 60], [128, 44], [128, 0]]);
    expect(piece(b, 'wedge:backLeft').backs).toEqual([{ x: 0, y: 0, w: 60, h: 10 }, { x: 0, y: 0, w: 10, h: 60 }]);
    expect(piece(b, tableId(c)).bbox).toEqual({ x: 60, y: 0, w: 32, h: 44 });
    expect(piece(b, idAt(c, 'back', 1)).bbox).toEqual({ x: 92, y: 0, w: 36, h: 44 });
    const left = piece(b, idAt(c, 'left', 0));
    expect(left.bbox).toEqual({ x: 0, y: 60, w: 44, h: 72 });
    expect(left.arm).toEqual({ at: 'end', facing: 'LAF', rect: { x: 0, y: 118, w: 44, h: 14 } });
    expect(left.backs).toEqual([{ x: 0, y: 60, w: 10, h: 58 }]);
    expect(left.cushionRect).toEqual({ x: 10, y: 60, w: 34, h: 58 });
    const right = piece(b, idAt(c, 'right', 0));
    expect(right.bbox).toEqual({ x: 144, y: 60, w: 44, h: 72 });
    expect(right.arm).toEqual({ at: 'end', facing: 'RAF', rect: { x: 144, y: 118, w: 44, h: 14 } });
    expect(right.backs).toEqual([{ x: 178, y: 60, w: 10, h: 58 }]);
    expect(right.cushionRect).toEqual({ x: 144, y: 60, w: 34, h: 58 });
    expect(b.runs.map((r) => [r.id, r.endCap])).toEqual([['back', null], ['left', 'arm'], ['right', 'arm']]);
    expect(b.wedge.readout).toBe('Wedge 60 × 60 · angled face 22.6"');
  });

  it('2. D = 36, auto wedge: C = 52, back armless 52, legs 80 (66+14), seat depth 26, outside 188/132/132', () => {
    for (const c of [op.setMeasurements(U(), { D: 36 }), standardU({ D: 36 })]) {
      const b = valid(c);
      expect(b.wedge).toMatchObject({ C: 52, auto: true });
      expect(desc(c, 'back')).toEqual(['table 32', 'armless 52']);
      expect(desc(c, 'left')).toEqual(['oneArm 80=66+14@end']);
      expect(desc(c, 'right')).toEqual(['oneArm 80=66+14@end']);
      expect(b.seatDepth).toBe(26);
      expect([b.W, b.L, b.R]).toEqual([188, 132, 132]);
    }
  });

  it('3a. table from the back to the end of the left leg in place of the arm: left 40 armless + 32 table, back armless 68', () => {
    const c0 = U();
    const c = op.moveTable(c0, tableId(c0), { run: 'left', at: 'replaceArm' });
    expect(desc(c, 'left')).toEqual(['armless 40', 'table 32']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    expect(valid(c).runs.find((r) => r.id === 'left')!.endCap).toBe('table');
    expect(c.runs.left![1]!.id).toBe(tableId(c0)); // the same table moved
  });

  it('3b. table to the middle of the left leg: 13 + 32 + 13 + 14 arm, and "seat under 20" fires', () => {
    const c0 = U();
    const c = op.moveTable(c0, tableId(c0), { run: 'left', at: 'split', pieceId: idAt(c0, 'left', 0) });
    expect(desc(c, 'left')).toEqual(['armless 13', 'table 32', 'oneArm 27=13+14@end']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    const b = valid(c);
    const under = b.warnings.filter((w) => w.code === 'seatUnder20');
    // Both cushions are 13" — including the one-arm piece whose FOOTPRINT is 27".
    expect(under.map((w) => w.pieceId)).toEqual([idAt(c, 'left', 0), idAt(c, 'left', 2)]);
    expect(b.exportBlocked).toBe(false); // warnings never block
  });

  it('4. L-right W120 R100 C60: back one-arm 60 (46+14), leg one-arm 40 (26+14)', () => {
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
  });

  it('5. auto-split: U with W = 300 -> back armless 148 becomes 2 x 74', () => {
    for (const c of [standardU({ W: 300 }), op.setMeasurements(U(), { W: 300 })]) {
      expect(desc(c, 'back')).toEqual(['table 32', 'armless 74', 'armless 74']);
      const [, a, b] = c.runs.back!;
      expect(a!.splitGroup).toBeDefined();
      expect(a!.splitGroup).toBe(b!.splitGroup);
      expect(valid(c).W).toBe(300);
    }
  });

  it('6. wedge slider 60 -> 55 on the Standard U: legs 77 (63+14), back armless 46, outside unchanged', () => {
    const c = op.setWedge(U(), 55);
    const b = valid(c);
    expect(b.wedge).toMatchObject({ C: 55, auto: false });
    expect(desc(c, 'left')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(c, 'right')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 46']);
    expect([b.W, b.L, b.R]).toEqual([188, 132, 132]);
  });

  it('7. open end on the right leg: one 72 armless piece', () => {
    const c = op.setEndCap(U(), 'right', 'open');
    expect(desc(c, 'right')).toEqual(['armless 72']);
    expect(valid(c).runs.find((r) => r.id === 'right')!.endCap).toBe('open');
  });

  it('8. Blank U W188 L132 R132, only the wedges placed: unfilled 68 / 72 / 72 and export blocked', () => {
    const c = deepFreeze(blankConfig('U', { W: 188, L: 132, R: 132 }));
    const b = valid(c);
    expect(b.pieces.map((p) => p.kind)).toEqual(['wedge', 'wedge']);
    expect(b.gaps.map((g) => [g.run, g.length, g.label])).toEqual([
      ['back', 68, 'unfilled 68"'],
      ['left', 72, 'unfilled 72"'],
      ['right', 72, 'unfilled 72"'],
    ]);
    expect(b.runs.map((r) => r.unfilled)).toEqual([68, 72, 72]);
    expect(b.exportBlocked).toBe(true);
  });

  it('9. every §12 case: each run sums exactly to its space and no piece exceeds 108', () => {
    const u = U();
    const cases = [
      u,
      op.setMeasurements(u, { D: 36 }),
      op.moveTable(u, tableId(u), { run: 'left', at: 'replaceArm' }),
      op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) }),
      standardL('right', { W: 120, R: 100 }),
      standardU({ W: 300 }),
      op.setWedge(u, 55),
      op.setEndCap(u, 'right', 'open'),
      blankConfig('U'),
    ];
    for (const c of cases) {
      const b = valid(c);
      for (const r of b.runs) {
        const sum = c.runs[r.id]!.reduce((s, p) => s + p.length, 0);
        expect(sum).toBe(available(c, r.id));
      }
      expect(b.pieces.every((p) => p.run === null || p.length <= 108)).toBe(true);
    }
  });
});
