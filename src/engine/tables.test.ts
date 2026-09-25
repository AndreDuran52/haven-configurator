import { describe, expect, it } from 'vitest';
import { standardU } from './defaults';
import { codes, deepFreeze, desc, idAt, op, raw, refused, runOf, shapeOf, tableId, test3b, U, valid } from './testing';
import type { Config, Pt } from './types';

describe('tables', () => {
  it('E21 tableOutsideArm_lockOn: left [one-arm 40 (26 + 14)][table 32], end cap armTable; back [armless 68]', () => {
    const u = U();
    const c = op.moveTable(u, tableId(u), { run: 'left', at: 'seam', seam: 1 });
    expect(desc(c, 'left')).toEqual(['oneArm 40=26+14@end', 'table 32']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    const b = valid(c);
    expect(runOf(b, 'left').endCap).toBe('armTable');
    expect(b.seats.label).toBe('Seats 6–7'); // the 26" left stretch is 0 comfortable / 1 snug
    // end-cap menu from armTable
    expect(desc(op.setEndCap(c, 'left', 'table'), 'left')).toEqual(['armless 40', 'table 32']);
    expect(desc(op.setEndCap(c, 'left', 'arm'), 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(desc(op.setEndCap(c, 'left', 'open'), 'left')).toEqual(['armless 72']);
  });

  it('E22 twoTables: a 24" table at right seam 0 gives [table 24][one-arm 48 (34 + 14)], Seats 6', () => {
    const c = op.addPiece(U(), 'table', { run: 'right', at: 'seam', seam: 0 }, { length: 24 });
    expect(desc(c, 'right')).toEqual(['table 24', 'oneArm 48=34+14@end']);
    const b = valid(c);
    expect(b.pieces.filter((p) => p.kind === 'table')).toHaveLength(2);
    expect(b.seats.label).toBe('Seats 6');
  });

  it('E5 tableSplitOddRemainder: L 132.5, split the left leg: [13.5][32][27 = 13 + 14]', () => {
    const u = deepFreeze(standardU({ L: 132.5 }));
    const c = op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) });
    expect(desc(c, 'left')).toEqual(['armless 13.5', 'table 32', 'oneArm 27=13+14@end']);
  });

  it('absorber tie-break: nearest seat, then the LARGER cushion, then the lower index', () => {
    const g = standardU({ W: 272 }); // back [T][60][60] (split group)
    const uneven = op.dragSeam(g, 'back', 2, 10);
    expect(desc(uneven, 'back')).toEqual(['table 32', 'armless 70', 'armless 50']);
    expect(desc(op.addPiece(uneven, 'table', { run: 'back', at: 'seam', seam: 2 }), 'back')).toEqual([
      'table 32', 'armless 38', 'table 32', 'armless 50',
    ]);
    const even = op.addPiece(g, 'table', { run: 'back', at: 'seam', seam: 2 });
    expect(desc(even, 'back')).toEqual(['table 32', 'armless 28', 'table 32', 'armless 60']);
    expect(even.runs.back!.every((p) => p.splitGroup === undefined)).toBe(true);
  });

  it('several tables: end cap "table" adds one; same-run seam moves are pure reorders', () => {
    const u = U();
    expect(desc(op.setEndCap(u, 'right', 'table'), 'right')).toEqual(['armless 40', 'table 32']);
    expect(desc(op.moveTable(u, tableId(u), { run: 'back', at: 'seam', seam: 1 }), 'back')).toEqual(['armless 36', 'table 32']);
    expect(raw.moveTable(u, tableId(u), { run: 'back', at: 'seam', seam: 0 })).toEqual({ config: u, rejected: null });
  });

  it('E30b replaceArm_onTableEnd_refused', () => {
    const c = op.setEndCap(U(), 'left', 'table'); // left [armless 40][table 32] + the back table
    refused(raw.moveTable(c, tableId(c), { run: 'left', at: 'replaceArm' }), c, 'notAllowed');
  });
});

describe('G1 merge-back', () => {
  it('E6 tableRoundTrip_restoresStandardU: 3b, then back to back seam 0', () => {
    const s = test3b();
    expect(s.runs.left!.map((p) => p.joinedBy)).toEqual([tableId(s), undefined, tableId(s)]);
    const back = op.moveTable(s, tableId(s), { run: 'back', at: 'seam', seam: 0 });
    expect(shapeOf(back)).toEqual(shapeOf(U()));
    expect(back.runs.left![0]!.id).toBe(U().runs.left![0]!.id); // the split target's id
  });

  it('E6c sameRunMove_mergesHalves: 3b, then the left leg end seam: [one-arm 40 (26 + 14)][table 32]', () => {
    const s = test3b();
    const c = op.moveTable(s, tableId(s), { run: 'left', at: 'seam', seam: 1 });
    expect(desc(c, 'left')).toEqual(['oneArm 40=26+14@end', 'table 32']);
  });

  it('deleting the splitting table merges the halves back', () => {
    const s = test3b();
    expect(desc(op.deletePiece(s, tableId(s)), 'left')).toEqual(['oneArm 72=58+14@end']);
  });

  it('a manual edit of a half clears both tags (no merge afterwards)', () => {
    const s = test3b();
    const resized = op.dragSeam(s, 'left', 1, 2); // the armless half grows, the table shrinks
    expect(resized.runs.left!.some((p) => p.joinedBy)).toBe(false);
    const out = op.moveTable(resized, tableId(resized), { run: 'back', at: 'seam', seam: 0 });
    expect(desc(out, 'left')).toEqual(['armless 45', 'oneArm 27=13+14@end']);
  });

  it('E23 lockOff_splitGrowsRun: [armless 29][table 32][one-arm 43 (29 + 14)], W 156, L 164, and back again', () => {
    const off = op.setLock(U(), false);
    const s = op.moveTable(off, tableId(off), { run: 'left', at: 'split', pieceId: idAt(off, 'left', 0) });
    expect(desc(s, 'left')).toEqual(['armless 29', 'table 32', 'oneArm 43=29+14@end']);
    expect([s.W, s.L]).toEqual([156, 164]);
    const back = op.moveTable(s, tableId(s), { run: 'back', at: 'seam', seam: 0 });
    expect([back.W, back.L]).toEqual([188, 132]);
    expect(shapeOf(back)).toEqual(shapeOf(U()));
  });
});

describe('G11 arm invariant', () => {
  it('E15 reorderOneArm_refused', () => {
    const s = test3b();
    refused(raw.reorderPiece(s, idAt(s, 'left', 2), 0), s, 'notAllowed');
  });

  it('E25 armInvariant_refusals', () => {
    const s = test3b();
    const r = refused(raw.reorderPiece(s, idAt(s, 'left', 0), 2), s, 'notAllowed');
    expect(r.message).toBe('Remove the arm first (end cap Open)');
    const u = U();
    const e21 = op.moveTable(u, tableId(u), { run: 'left', at: 'seam', seam: 1 });
    refused(raw.addPiece(e21, 'armless', { run: 'left', at: 'seam', seam: 2 }), e21, 'notAllowed');
    refused(raw.addPiece(u, 'oneArm', { run: 'back', at: 'seam', seam: 1 }), u, 'notAllowed');
    refused(raw.convertPiece(u, idAt(u, 'back', 1)), u, 'notAllowed'); // the U back has no open end
  });
});

describe('table dragging', () => {
  const snap = (c: Config, p: Pt) => {
    deepFreeze(c);
    const { result } = raw.snapTable(c, tableId(c), p);
    expect(result.rejected).toBeNull();
    valid(result.config);
    return result.config;
  };

  it('snaps to the nearest anchor, resolved on the drag-start config', () => {
    const u = U();
    expect(desc(snap(u, [115, 22]), 'back')).toEqual(['armless 36', 'table 32']); // the other seam
    expect(desc(snap(u, [95, 22]), 'back')).toEqual(['armless 18', 'table 32', 'armless 18']); // split the back seat
    expect(desc(snap(u, [22, 92]), 'left')).toEqual(['armless 13', 'table 32', 'oneArm 27=13+14@end']); // = 3b
    expect(desc(snap(u, [22, 125]), 'left')).toEqual(['armless 40', 'table 32']); // arm centre: replaceArm = 3a
    expect(desc(snap(u, [22, 150]), 'left')).toEqual(['oneArm 40=26+14@end', 'table 32']); // beyond the end: outside the arm
    expect(raw.snapTable(u, tableId(u), [76, 22]).result.config).toBe(u); // on its own spot: nothing changes
  });

  it('anchors: the open-end seam next to an arm exists only as "outside the arm"; hysteresis keeps the current target', () => {
    const u = U();
    const t = raw.anchoredTargets(u, tableId(u)).filter((a) => a.placement.run === 'left');
    expect(t.map((a) => [a.placement.at, a.anchor])).toEqual([
      ['seam', [22, 76]],
      ['split', [22, 89]],
      ['replaceArm', [22, 125]],
      ['seam', [22, 148]],
    ]);
    const current = { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) } as const;
    // (22, 81) is 5 nearer the seam-0 anchor than the split one: within 6" hysteresis, keep the split
    expect(raw.snapTable(u, tableId(u), [22, 81], current).placement).toEqual(current);
    expect(raw.snapTable(u, tableId(u), [22, 78], current).placement).toEqual({ run: 'left', at: 'seam', seam: 0 });
  });

  it('while dragging from 3b the warning is live, and the drop back on the back run restores the Standard U', () => {
    const s = test3b();
    expect(codes(valid(s))).toContain('seatUnder20');
    expect(shapeOf(snap(s, [76, 22]))).toEqual(shapeOf(U()));
  });
});
