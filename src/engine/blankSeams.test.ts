import { describe, expect, it } from 'vitest';
import { blankConfig, standardU } from './defaults';
import { valid, op, U, desc, idAt, tableId, raw } from './testing';

describe('blank mode', () => {
  it('reports gaps while partially filled; new pieces eat the nearest gap first, then cascade into seats', () => {
    const b0 = blankConfig('U');
    const b1 = op.addPiece(b0, 'oneArm', { run: 'left', at: 'seam', seam: 1 });
    expect(desc(b1, 'left')).toEqual(['gap 22', 'oneArm 50=36+14@end']);
    const g = valid(b1).gaps.find((x) => x.run === 'left')!;
    expect(g).toMatchObject({ offset: 0, length: 22, label: 'unfilled 22"', rect: { x: 0, y: 60, w: 44, h: 22 } });
    expect(valid(b1).runs.find((r) => r.id === 'left')).toMatchObject({ filled: 50, unfilled: 22, endCap: 'arm' });
    const b2 = op.addPiece(b1, 'table', { run: 'back', at: 'seam', seam: 0 });
    expect(desc(b2, 'back')).toEqual(['table 32', 'gap 36']);
    expect(valid(b2).exportBlocked).toBe(true);
    // 30" into [gap 22][oneArm 50]: the gap gives 22, the seat gives the other 8
    const b3 = op.addPiece(b1, 'armless', { run: 'left', at: 'seam', seam: 0 }, { length: 30 });
    expect(desc(b3, 'left')).toEqual(['armless 30', 'oneArm 42=28+14@end']);
  });

  it('in a partially filled run, deletes and growth leave gaps in place (placed pieces do not move)', () => {
    const b2 = op.addPiece(blankConfig('U'), 'table', { run: 'back', at: 'seam', seam: 0 });
    const b4 = op.addPiece(b2, 'armless', { run: 'back', at: 'seam', seam: 1 }, { length: 20 });
    expect(desc(b4, 'back')).toEqual(['table 32', 'armless 20', 'gap 16']);
    const b5 = op.deletePiece(b4, tableId(b4));
    expect(desc(b5, 'back')).toEqual(['gap 32', 'armless 20', 'gap 16']);
    const backGaps = valid(b5).gaps.filter((x) => x.run === 'back');
    expect(backGaps.map((x) => [x.offset, x.length])).toEqual([[0, 32], [52, 16]]);
    const b1 = op.addPiece(blankConfig('U'), 'oneArm', { run: 'left', at: 'seam', seam: 1 });
    expect(desc(op.setMeasurements(b1, { L: 142 }), 'left')).toEqual(['gap 22', 'oneArm 50=36+14@end', 'gap 10']);
    // deleting the last piece of a filled run leaves a gap too (nothing to absorb)
    expect(desc(op.deletePiece(U(), idAt(U(), 'left', 0)), 'left')).toEqual(['gap 72']);
  });

  it('filling every gap unblocks export and reproduces the Standard U', () => {
    let c = blankConfig('U');
    c = op.addPiece(c, 'table', { run: 'back', at: 'seam', seam: 0 });
    c = op.addPiece(c, 'armless', { run: 'back', at: 'seam', seam: 1 });
    c = op.addPiece(c, 'oneArm', { run: 'left', at: 'seam', seam: 0 }, { length: 72 });
    c = op.addPiece(c, 'oneArm', { run: 'right', at: 'seam', seam: 0 }, { length: 72 });
    const b = valid(c);
    expect(b.gaps).toEqual([]);
    expect(b.exportBlocked).toBe(false);
    for (const r of ['back', 'left', 'right'] as const) expect(desc(c, r)).toEqual(desc(U(), r));
    expect(b.seats.label).toBe('Seats 7');
  });
});

describe('seam handles', () => {
  const s0 = () => {
    const u = U();
    return op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) }); // [13][T32][27]
  };

  it('keeps the pair total, snaps to 0.5 and clamps (table 16..40, seat >= min(20, now), piece <= 108)', () => {
    const s = s0();
    expect(desc(op.dragSeam(s, 'left', 1, 10), 'left')).toEqual(['armless 23', 'table 22', 'oneArm 27=13+14@end']);
    expect(desc(op.dragSeam(s, 'left', 1, 25), 'left')).toEqual(['armless 29', 'table 16', 'oneArm 27=13+14@end']);
    expect(raw.dragSeam(s, 'left', 1, -5)).toBe(s); // the 13" seat may not shrink further
    expect(desc(op.dragSeam(s, 'left', 2, -3.3), 'left')).toEqual(['armless 13', 'table 28.5', 'oneArm 30.5=16.5+14@end']);
    const u = U();
    expect(raw.dragSeam(u, 'back', 0, 5)).toBe(u); // wedge edge: use the wedge slider
    expect(raw.dragSeam(u, 'left', 1, 5)).toBe(u); // open end: no neighbour
    const big = standardU({ W: 300 });
    expect(desc(op.dragSeam(big, 'back', 2, 50), 'back')).toEqual(['table 32', 'armless 108', 'armless 40']);
  });

  it('a split group on one side of a seam moves as one logical seat (stays equal, keeps its group)', () => {
    const big = standardU({ W: 300 }); // [T 32][74 g][74 g]
    const wider = op.dragSeam(big, 'back', 1, 4);
    expect(desc(wider, 'back')).toEqual(['table 36', 'armless 72', 'armless 72']);
    expect(wider.runs.back![1]!.splitGroup).toBe(big.runs.back![1]!.splitGroup);
    expect(desc(op.dragSeam(big, 'back', 1, -10), 'back')).toEqual(['table 22', 'armless 79', 'armless 79']);
    expect(desc(op.dragSeam(big, 'back', 1, 20), 'back')).toEqual(['table 40', 'armless 70', 'armless 70']); // table clamps at 40
  });

  it('dragging into a blank-mode gap resizes the piece; the gap disappears at 0', () => {
    const b2 = op.addPiece(blankConfig('U'), 'table', { run: 'back', at: 'seam', seam: 0 });
    const b4 = op.addPiece(b2, 'armless', { run: 'back', at: 'seam', seam: 1 }, { length: 20 });
    expect(desc(op.dragSeam(b4, 'back', 2, 10), 'back')).toEqual(['table 32', 'armless 30', 'gap 6']);
    const full = op.dragSeam(b4, 'back', 2, 99);
    expect(desc(full, 'back')).toEqual(['table 32', 'armless 36']);
    expect(valid(full).runs.find((r) => r.id === 'back')).toMatchObject({ unfilled: 0, filled: 68 });
  });
});

describe('pieces menu', () => {
  it('convert keeps the footprint; reorder is a pure permutation', () => {
    const u = U();
    expect(desc(op.convertPiece(u, idAt(u, 'left', 0)), 'left')).toEqual(['armless 72']);
    expect(desc(op.convertPiece(u, idAt(u, 'back', 1)), 'back')).toEqual(['table 32', 'oneArm 36=22+14@end']);
    const s = op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) });
    expect(raw.convertPiece(s, idAt(s, 'left', 0))).toBe(s); // 13" can't carry a 14" arm
    expect(desc(op.reorderPiece(u, tableId(u), 1), 'back')).toEqual(['armless 36', 'table 32']);
  });
});
