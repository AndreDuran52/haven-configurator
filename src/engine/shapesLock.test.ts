import { describe, expect, it } from 'vitest';
import { standardL, standardU } from './defaults';
import { desc, idAt, op, raw, refused, shapeOf, tableId, U, valid } from './testing';
import type { BuildResult, Config, Pt, RunId } from './types';

const sofa = (b: BuildResult) => b.pieces.filter((p) => p.run || p.corner);
const norm = (poly: Pt[]) => poly.map((p) => `${p[0]},${p[1]}`).sort().join(' ');
const withoutNextId = (c: Config) => ({ ...c, nextId: 0 });

describe('shapes', () => {
  it('E2 lLeft_mirrorsTest4: L-left is the exact mirror of test 4 (x -> W - x, LAF <-> RAF)', () => {
    const r = valid(standardL('right', { W: 120, R: 100 }));
    const l = valid(standardL('left', { W: 120, L: 100 }));
    const mirror = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [120 - x, y]);
    expect(sofa(l).map((p) => norm(p.polygon)).sort()).toEqual(sofa(r).map((p) => norm(mirror(p.polygon))).sort());
    const armOf = (b: BuildResult, run: RunId) => b.pieces.find((p) => p.run === run)!.arm!;
    expect(armOf(r, 'back')).toMatchObject({ at: 'start', facing: 'LAF', rect: { x: 0, w: 14 } });
    expect(armOf(l, 'back')).toMatchObject({ at: 'end', facing: 'RAF', rect: { x: 106, w: 14 } });
    expect(armOf(r, 'right').facing).toBe('RAF');
    expect(armOf(l, 'left').facing).toBe('LAF');
    expect(r.seats).toEqual(l.seats);
  });

  it('E18 standardL_default: 132 × 132, back one-arm 72, leg one-arm 72, no table', () => {
    for (const side of ['left', 'right'] as const) {
      const c = standardL(side);
      const b = valid(c);
      expect([b.W, side === 'left' ? b.L : b.R]).toEqual([132, 132]);
      expect(desc(c, 'back')).toEqual([`oneArm 72=58+14@${side === 'left' ? 'end' : 'start'}`]);
      expect(desc(c, side)).toEqual(['oneArm 72=58+14@end']);
      expect(b.pieces.some((p) => p.kind === 'table')).toBe(false);
    }
  });

  it('E19 setShape_UtoLRight_keepsBack: back [table 32][armless 96], end cap table (G2)', () => {
    const c = op.setShape(U(), 'L-right');
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 96']);
    expect(desc(c, 'right')).toEqual(['oneArm 72=58+14@end']);
    expect(c.runs.left).toBeUndefined();
    const b = valid(c);
    expect(b.runs.find((r) => r.id === 'back')!.endCap).toBe('table');
    expect([b.W, b.R]).toEqual([188, 132]);
    // U -> L-left: the open end is a seat, which takes the arm (footprint kept)
    expect(desc(op.setShape(U(), 'L-left'), 'back')).toEqual(['table 32', 'oneArm 96=82+14@end']);
  });

  it('G2: the shape picker keeps edited back pieces; lock off holds W too', () => {
    const edited = op.dragSeam(U(), 'back', 1, 4); // [table 36][armless 32]
    expect(desc(op.setShape(edited, 'L-right'), 'back')).toEqual(['table 36', 'armless 92']);
    const off = op.setShape(op.setLock(U(), false), 'L-left');
    expect([off.W, off.L]).toEqual([188, 132]);
  });

  it('E26 setShape_roundTrips: L-right -> U -> L-right equals the original; L-right -> L-left -> L-right is the identity', () => {
    const lr = standardL('right');
    const u = op.setShape(lr, 'U');
    expect(shapeOf(u)).toEqual({ back: ['armless 12'], left: ['oneArm 72=58+14@end'], right: ['oneArm 72=58+14@end'] });
    expect(withoutNextId(op.setShape(u, 'L-right'))).toEqual(withoutNextId(lr));
    const ll = op.setShape(lr, 'L-left');
    expect(desc(ll, 'back')).toEqual(['oneArm 72=58+14@end']);
    expect(op.setShape(ll, 'L-right')).toEqual(lr);
  });

  it('G2: L -> U refuses with the minimum W when the back cannot give up C', () => {
    const lr = standardL('right', { W: 70, R: 132 }); // back 10: needs -60 at the start
    const r = refused(raw.setShape(lr, 'U'), lr, 'infeasible');
    expect(r.min).toEqual({ W: 126 }); // 2 x 60 + 6
    expect(raw.setShape(lr, 'L-right')).toEqual({ config: lr, rejected: null }); // no-op
  });
});

describe('lock outside size', () => {
  it('E1 lockOff_tableReplacesArm_growsLegBy18: W 156, L 150; setEndCap(left, table) instead: W 188, L 150 (G5)', () => {
    const off = op.setLock(U(), false);
    const c = op.moveTable(off, tableId(off), { run: 'left', at: 'replaceArm' });
    expect(desc(c, 'left')).toEqual(['armless 58', 'table 32']);
    expect([c.W, c.L]).toEqual([156, 150]);
    const cap = op.setEndCap(off, 'left', 'table');
    expect([cap.W, cap.L]).toEqual([188, 150]);
  });

  it('G5: adding / removing an arm keeps the footprint (lock on) or the cushion (lock off)', () => {
    const u = U();
    expect(desc(op.convertPiece(u, idAt(u, 'left', 0)), 'left')).toEqual(['armless 72']);
    const off = op.setLock(u, false);
    const noArm = op.convertPiece(off, idAt(off, 'left', 0));
    expect(desc(noArm, 'left')).toEqual(['armless 58']);
    expect(noArm.L).toBe(118);
    const back = op.convertPiece(noArm, idAt(noArm, 'left', 0));
    expect(desc(back, 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(back.L).toBe(132);
  });

  it('E13 lockOff_seamDrag_keepsTotals_relockFreezes', () => {
    const off = op.setLock(U(), false);
    const a = op.dragSeam(off, 'back', 1, 6);
    expect(desc(a, 'back')).toEqual(['table 38', 'armless 30']);
    expect(a.W).toBe(188);
    const b = op.addPiece(a, 'armless', { run: 'back', at: 'seam', seam: 2 }, { length: 20 });
    expect(b.W).toBe(208);
    const c = op.setLock(b, true);
    expect(c.W).toBe(208);
    expect(op.resizePiece(c, idAt(c, 'back', 1), 25).W).toBe(208);
  });

  it('lock OFF: edits grow/shrink runs and W/L/R follow the pieces; typed sizes still rebalance', () => {
    const c1 = op.setLock(U(), false);
    const backSeat = idAt(c1, 'back', 1);
    const c2 = op.resizePiece(c1, backSeat, 50);
    expect([c2.W, c2.L, c2.R]).toEqual([202, 132, 132]);
    expect(valid(c2).opening).toEqual({ width: 114, depth: 88 });
    const c3 = op.addPiece(c2, 'armless', { run: 'left', at: 'seam', seam: 0 });
    expect(c3.L).toBe(168);
    expect(op.deletePiece(c1, backSeat).W).toBe(152);
    const moved = op.moveTable(c1, tableId(c1), { run: 'left', at: 'seam', seam: 1 });
    expect([moved.W, moved.L]).toEqual([156, 164]); // back loses 32, left gains 32
    const typed = op.setMeasurements(c2, { W: 210 });
    expect(typed.W).toBe(210);
    expect(desc(typed, 'back')).toEqual(['table 32', 'armless 58']);
  });

  it('E30a lockOff_deleteLastLegPiece_refused', () => {
    const off = op.setLock(U(), false);
    refused(raw.deletePiece(off, idAt(off, 'left', 0)), off, 'notAllowed');
    // the back run is not a leg: deleting its last seat is fine
    const noTable = op.deletePiece(off, tableId(off));
    expect(op.deletePiece(noTable, idAt(noTable, 'back', 0)).W).toBe(120);
  });

  it('lock ON refuses what nothing can absorb, with the same reference back', () => {
    const u = U();
    refused(raw.resizePiece(u, idAt(u, 'back', 1), 60), u, 'noRoom'); // tables never absorb
    const small = standardU({ W: 140 }); // the preset drops the table instead
    expect(desc(small, 'back')).toEqual(['armless 20']);
    expect(valid(small).warnings.map((w) => w.code)).toContain('openingUnder60');
  });
});
