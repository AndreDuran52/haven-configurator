import { describe, expect, it } from 'vitest';
import { blankConfig, standardU } from './defaults';
import { desc, idAt, op, raw, refused, runOf, shapeOf, tableId, test3b, U, valid } from './testing';

describe('blank mode', () => {
  it('reports gaps while partially filled; new pieces eat the nearest gap first, then cascade into seats', () => {
    const b0 = blankConfig('U');
    const b1 = op.addPiece(b0, 'oneArm', { run: 'left', at: 'seam', seam: 1 });
    expect(desc(b1, 'left')).toEqual(['gap 22', 'oneArm 50=36+14@end']);
    const g = valid(b1).gaps.find((x) => x.run === 'left')!;
    expect(g).toMatchObject({ offset: 0, length: 22, label: 'unfilled 22"', rect: { x: 0, y: 60, w: 44, h: 22 } });
    expect(runOf(valid(b1), 'left')).toMatchObject({ filled: 50, unfilled: 22, endCap: 'arm' });
    const b2 = op.addPiece(b1, 'table', { run: 'back', at: 'seam', seam: 0 });
    expect(desc(b2, 'back')).toEqual(['table 32', 'gap 36']);
    expect(valid(b2).exportBlocked).toBe(true);
    const b3 = op.addPiece(b1, 'armless', { run: 'left', at: 'seam', seam: 0 }, { length: 30 });
    expect(desc(b3, 'left')).toEqual(['armless 30', 'oneArm 42=28+14@end']);
  });

  it('in a partially filled run, deletes leave gaps in place (placed pieces do not move)', () => {
    const b2 = op.addPiece(blankConfig('U'), 'table', { run: 'back', at: 'seam', seam: 0 });
    const b4 = op.addPiece(b2, 'armless', { run: 'back', at: 'seam', seam: 1 }, { length: 20 });
    expect(desc(b4, 'back')).toEqual(['table 32', 'armless 20', 'gap 16']);
    const b5 = op.deletePiece(b4, tableId(b4));
    expect(desc(b5, 'back')).toEqual(['gap 32', 'armless 20', 'gap 16']);
    expect(valid(b5).gaps.filter((x) => x.run === 'back').map((x) => [x.offset, x.length])).toEqual([[0, 32], [52, 16]]);
    // deleting the last piece of a filled run leaves a gap too (nothing to absorb)
    expect(desc(op.deletePiece(U(), idAt(U(), 'left', 0)), 'left')).toEqual(['gap 72']);
  });

  it('a freed gap never lands between an arm and its open end (G11)', () => {
    const b1 = op.addPiece(blankConfig('U'), 'oneArm', { run: 'left', at: 'seam', seam: 1 }); // [gap 22][one-arm 50]
    const smaller = op.resizePiece(b1, idAt(b1, 'left', 1), 40);
    expect(desc(smaller, 'left')).toEqual(['gap 32', 'oneArm 40=26+14@end']);
  });

  it('E12 blank_fillUnblocksExport: filling every gap reproduces the Standard U', () => {
    let c = blankConfig('U');
    c = op.addPiece(c, 'table', { run: 'back', at: 'seam', seam: 0 });
    c = op.fillGap(c, idAt(c, 'back', 1), 'armless');
    c = op.fillGap(c, idAt(c, 'left', 0), 'oneArm');
    c = op.fillGap(c, idAt(c, 'right', 0), 'oneArm');
    const b = valid(c);
    expect(b.gaps).toEqual([]);
    expect(b.exportBlocked).toBe(false);
    expect(shapeOf(c)).toEqual(shapeOf(U()));
    expect(b.seats.label).toBe('Seats 7');
  });

  it('fillGap: the arm only at an open end with a 6" cushion left; tables up to 108; seats need 6"', () => {
    const b = blankConfig('U');
    expect(desc(op.fillGap(b, idAt(b, 'back', 0), 'oneArm'), 'back')).toEqual(['armless 68']); // no open end
    const small = blankConfig('U', { L: 79 }); // left gap 19: 19 - 14 < 6
    expect(desc(op.fillGap(small, idAt(small, 'left', 0), 'oneArm'), 'left')).toEqual(['armless 19']);
    const tiny = blankConfig('U', { L: 64 }); // left gap 4
    refused(raw.fillGap(tiny, idAt(tiny, 'left', 0), 'armless'), tiny, 'noRoom');
    const wide = blankConfig('U', { W: 300 }); // back gap 180
    refused(raw.fillGap(wide, idAt(wide, 'back', 0), 'table'), wide, 'notAllowed');
    expect(desc(op.fillGap(wide, idAt(wide, 'back', 0), 'armless'), 'back')).toEqual(['armless 90', 'armless 90']);
    refused(raw.fillGap(b, 'nope', 'armless'), b, 'notAllowed');
  });

  it('E24 blank_lockOff_takesGapsFirst: table at back seam 0 gives [table 32][gap 36], W 188', () => {
    const c = op.addPiece(op.setLock(blankConfig('U'), false), 'table', { run: 'back', at: 'seam', seam: 0 });
    expect(desc(c, 'back')).toEqual(['table 32', 'gap 36']);
    expect(c.W).toBe(188);
    // beyond the gap, the run grows
    const more = op.addPiece(c, 'armless', { run: 'back', at: 'seam', seam: 1 }, { length: 50 });
    expect(desc(more, 'back')).toEqual(['table 32', 'armless 50']);
    expect(more.W).toBe(202);
  });
});

describe('seam handles', () => {
  it('keeps the pair total, snaps to 0.5 and clamps (table 16..40, seat >= min(20, now), piece <= 108)', () => {
    const s = test3b(); // [13][T32][27]
    expect(desc(op.dragSeam(s, 'left', 1, 10), 'left')).toEqual(['armless 23', 'table 22', 'oneArm 27=13+14@end']);
    expect(desc(op.dragSeam(s, 'left', 1, 25), 'left')).toEqual(['armless 29', 'table 16', 'oneArm 27=13+14@end']);
    expect(raw.dragSeam(s, 'left', 1, -5)).toEqual({ config: s, rejected: null }); // the 13" seat may not shrink further
    expect(desc(op.dragSeam(s, 'left', 2, -3.3), 'left')).toEqual(['armless 13', 'table 28.5', 'oneArm 30.5=16.5+14@end']);
    const u = U();
    refused(raw.dragSeam(u, 'back', 0, 5), u, 'notAllowed'); // wedge edge: use the wedge slider
    refused(raw.dragSeam(u, 'left', 1, 5), u, 'notAllowed'); // open end: no neighbour
    const big = standardU({ W: 300 });
    expect(desc(op.dragSeam(big, 'back', 2, 50), 'back')).toEqual(['table 32', 'armless 108', 'armless 40']);
  });

  it('a split group on one side of a seam moves as one logical seat (stays equal, keeps its group)', () => {
    const big = standardU({ W: 300 }); // [T 32][74 g][74 g]
    const wider = op.dragSeam(big, 'back', 1, 4);
    expect(desc(wider, 'back')).toEqual(['table 36', 'armless 72', 'armless 72']);
    expect(wider.runs.back![1]!.splitGroup).toBe(big.runs.back![1]!.splitGroup);
    expect(desc(op.dragSeam(big, 'back', 1, 20), 'back')).toEqual(['table 40', 'armless 70', 'armless 70']);
  });

  it('dragging into a blank-mode gap resizes the piece; the gap disappears at 0', () => {
    const b2 = op.addPiece(blankConfig('U'), 'table', { run: 'back', at: 'seam', seam: 0 });
    const b4 = op.addPiece(b2, 'armless', { run: 'back', at: 'seam', seam: 1 }, { length: 20 });
    expect(desc(op.dragSeam(b4, 'back', 2, 10), 'back')).toEqual(['table 32', 'armless 30', 'gap 6']);
    const full = op.dragSeam(b4, 'back', 2, 99);
    expect(desc(full, 'back')).toEqual(['table 32', 'armless 36']);
    expect(runOf(valid(full), 'back')).toMatchObject({ unfilled: 0, filled: 68 });
  });

  it('seam drags must use the cumulative dx from the gesture start (per-event 0.5" snapping drifts)', () => {
    const s = standardU({ W: 272 });
    let inc = s;
    for (let k = 0; k < 10; k++) inc = raw.dragSeam(inc, 'back', 2, 0.3).config;
    expect(desc(op.dragSeam(s, 'back', 2, 3), 'back')).toEqual(['table 32', 'armless 63', 'armless 57']);
    expect(desc(inc, 'back')).toEqual(['table 32', 'armless 65', 'armless 55']);
  });
});

describe('pieces menu', () => {
  it('convert keeps the footprint (lock on); reorder is a pure permutation', () => {
    const u = U();
    expect(desc(op.convertPiece(u, idAt(u, 'left', 0)), 'left')).toEqual(['armless 72']);
    const s = test3b();
    refused(raw.convertPiece(s, idAt(s, 'left', 0)), s, 'notAllowed'); // not the last seat before the open end
    expect(desc(op.reorderPiece(u, tableId(u), 1), 'back')).toEqual(['armless 36', 'table 32']);
    const e27 = refused(raw.resizePiece(u, idAt(u, 'back', 1), 3), u, 'noRoom');
    expect(e27.message).toContain('6″');
    refused(raw.deletePiece(u, 'wedge:backLeft'), u, 'notAllowed');
    refused(raw.reorderPiece(u, 'wedge:backLeft', 0), u, 'notAllowed');
  });

  it('E27 cushionFloor: standardU({L: 79}) gives left [armless 19] (no arm)', () => {
    expect(desc(standardU({ L: 79 }), 'left')).toEqual(['armless 19']);
  });
});
