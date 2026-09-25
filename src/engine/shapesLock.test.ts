import { describe, expect, it } from 'vitest';
import { standardL, standardU } from './defaults';
import { valid, op, U, desc, idAt, tableId, codes, raw } from './testing';
import type { BuildResult, Pt, RunId } from './types';

// ---------------------------------------------------------------------------
// Edge cases the model must decide

describe('shapes', () => {
  it('L-left is the exact mirror of test 4 (x -> W - x, LAF <-> RAF)', () => {
    const r = valid(standardL('right', { W: 120, R: 100 }));
    const l = valid(standardL('left', { W: 120, L: 100 }));
    const norm = (poly: Pt[]) => poly.map((p) => `${p[0]},${p[1]}`).sort().join(' ');
    const mirror = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [120 - x, y]);
    const sofa = (b: BuildResult) => b.pieces.filter((p) => p.run || p.corner);
    expect(sofa(l).map((p) => norm(p.polygon)).sort()).toEqual(sofa(r).map((p) => norm(mirror(p.polygon))).sort());
    const armOf = (b: BuildResult, run: RunId) => b.pieces.find((p) => p.run === run)!.arm!;
    expect(armOf(r, 'back')).toMatchObject({ at: 'start', facing: 'LAF', rect: { x: 0, w: 14 } });
    expect(armOf(l, 'back')).toMatchObject({ at: 'end', facing: 'RAF', rect: { x: 106, w: 14 } });
    expect(armOf(r, 'right').facing).toBe('RAF');
    expect(armOf(l, 'left').facing).toBe('LAF');
    expect(r.seats).toEqual(l.seats);
  });

  it('setShape keeps a surviving leg and default-fills the back (its end kinds changed)', () => {
    const c = op.setShape(op.setEndCap(U(), 'right', 'open'), 'L-right');
    expect(desc(c, 'right')).toEqual(['armless 72']);
    // back = W - C = 128 -> one-arm 128 (arm at the open start) -> auto-split, equal cushions 57 / 57
    expect(desc(c, 'back')).toEqual(['oneArm 71=57+14@start', 'armless 57']);
  });
});

describe('lock outside size', () => {
  it('lock OFF: edits grow/shrink runs and W/L/R are derived from the pieces; lock ON freezes them', () => {
    const c1 = op.setLock(U(), false);
    const backSeat = idAt(c1, 'back', 1);
    const c2 = op.resizePiece(c1, backSeat, 50);
    expect(desc(c2, 'back')).toEqual(['table 32', 'armless 50']);
    expect([c2.W, c2.L, c2.R]).toEqual([202, 132, 132]); // 60 + 32 + 50 + 60
    expect(valid(c2).opening).toEqual({ width: 114, depth: 88 });
    const c3 = op.addPiece(c2, 'armless', { run: 'left', at: 'seam', seam: 0 });
    expect(desc(c3, 'left')).toEqual(['armless 36', 'oneArm 72=58+14@end']);
    expect(c3.L).toBe(168);
    expect(op.deletePiece(c1, backSeat).W).toBe(152); // run shrinks when unlocked
    const moved = op.moveTable(c1, tableId(c1), { run: 'left', at: 'seam', seam: 1 });
    expect([moved.W, moved.L]).toEqual([156, 164]); // back loses 32, left gains 32

    const c4 = op.setLock(c3, true);
    expect([c4.W, c4.L, c4.R]).toEqual([202, 168, 132]);
    const c5 = op.resizePiece(c4, tableId(c4), 40);
    expect(desc(c5, 'back')).toEqual(['table 40', 'armless 42']);
    expect(c5.W).toBe(202);
    const c6 = op.deletePiece(c4, idAt(c4, 'left', 0));
    expect(desc(c6, 'left')).toEqual(['oneArm 108=94+14@end']);
    expect(c6.L).toBe(168);
  });

  it('typed measurements always rebalance, even with the lock off', () => {
    const c = op.setMeasurements(op.resizePiece(op.setLock(U(), false), idAt(U(), 'back', 1), 50), { W: 210 });
    expect(c.W).toBe(210);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 58']);
  });

  it('lock ON rejects an edit nothing can absorb (same reference back)', () => {
    const u = U();
    // back seat 36 -> 60 would need the table to shrink: tables never absorb
    expect(raw.resizePiece(u, idAt(u, 'back', 1), 60)).toBe(u);
    // W = 140: the back needs -48 but its only seat can give 30 (6" floor)
    expect(raw.setMeasurements(u, { W: 140 })).toBe(u);
    // ...while the preset at W = 140 drops the table and warns about the opening
    const small = standardU({ W: 140 });
    expect(desc(small, 'back')).toEqual(['armless 20']);
    expect(codes(valid(small))).toContain('openingUnder60');
  });
});
