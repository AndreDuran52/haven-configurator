import { describe, expect, it } from 'vitest';
import { standardU } from './defaults';
import { deepFreeze, valid, op, U, desc, idAt, tableId, piece, raw } from './testing';
import type { Config } from './types';

describe('tables', () => {
  it('table OUTSIDE the arm at a run end with the lock on', () => {
    const u = U();
    const c = op.moveTable(u, tableId(u), { run: 'left', at: 'seam', seam: 1 });
    expect(desc(c, 'left')).toEqual(['oneArm 40=26+14@end', 'table 32']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    const b = valid(c);
    expect(b.runs.find((r) => r.id === 'left')!.endCap).toBe('armTable');
    expect(piece(b, idAt(c, 'left', 0)).arm!.rect).toEqual({ x: 0, y: 86, w: 44, h: 14 });
    expect(piece(b, tableId(c)).bbox).toEqual({ x: 0, y: 100, w: 44, h: 32 });
    expect(b.seats.label).toBe('Seats 6–7'); // the 26" left stretch is 0 comfortable / 1 snug
    // end-cap menu from armTable
    expect(desc(op.setEndCap(c, 'left', 'table'), 'left')).toEqual(['armless 40', 'table 32']);
    expect(desc(op.setEndCap(c, 'left', 'arm'), 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(desc(op.setEndCap(c, 'left', 'open'), 'left')).toEqual(['armless 72']);
  });

  it('several tables: end cap "table" adds one; same-run moves are pure reorders', () => {
    const u = U();
    const c = op.setEndCap(u, 'right', 'table');
    expect(desc(c, 'right')).toEqual(['armless 40', 'table 32']);
    expect(valid(c).pieces.filter((p) => p.kind === 'table')).toHaveLength(2);
    const r = op.moveTable(u, tableId(u), { run: 'back', at: 'seam', seam: 1 });
    expect(desc(r, 'back')).toEqual(['armless 36', 'table 32']);
    expect(raw.moveTable(u, tableId(u), { run: 'back', at: 'seam', seam: 0 })).toBe(u); // no-op
  });

  it('absorber tie-break: nearest seat, then the LARGER cushion, then the lower index', () => {
    // [T][70][50]: a table dropped between the two seats is paid for by the 70
    const g = standardU({ W: 272 }); // back [T][60][60] (split group)
    const uneven = op.dragSeam(g, 'back', 2, 10);
    expect(desc(uneven, 'back')).toEqual(['table 32', 'armless 70', 'armless 50']);
    expect(desc(op.addPiece(uneven, 'table', { run: 'back', at: 'seam', seam: 2 }), 'back')).toEqual([
      'table 32', 'armless 38', 'table 32', 'armless 50',
    ]);
    // equal sizes -> the lower index (toward the run start) pays; the split group dissolves
    const even = op.addPiece(g, 'table', { run: 'back', at: 'seam', seam: 2 });
    expect(desc(even, 'back')).toEqual(['table 32', 'armless 28', 'table 32', 'armless 60']);
    expect(even.runs.back!.every((p) => p.splitGroup === undefined)).toBe(true);
  });

  it('split placement with an odd remainder: the extra 0.5 goes to the side away from the arm', () => {
    const u = U();
    const c = op.addPiece(u, 'table', { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) }, { length: 31.5 });
    expect(desc(c, 'left')).toEqual(['armless 13.5', 'table 31.5', 'oneArm 27=13+14@end']);
  });
});

describe('table dragging', () => {
  it('snapTable picks the nearest feasible snap target from the drag-start config', () => {
    const u = U();
    const t = tableId(u);
    const snap = (c: Config, p: [number, number]) => {
      deepFreeze(c);
      const next = raw.snapTable(c, t, p);
      valid(next);
      return next;
    };
    // along the back: the other seam (a pure reorder)...
    expect(desc(snap(u, [120, 22]), 'back')).toEqual(['armless 36', 'table 32']);
    // ...or the middle of the back seat, which first re-absorbs the table (68) then splits it
    expect(desc(snap(u, [95, 22]), 'back')).toEqual(['armless 18', 'table 32', 'armless 18']);
    // middle of the left leg -> splits the seat = test 3b
    const mid = snap(u, [22, 96]);
    expect(desc(mid, 'left')).toEqual(['armless 13', 'table 32', 'oneArm 27=13+14@end']);
    // end of the left leg -> outside the arm; the end-cap menu then swaps the arm for the table = test 3a
    const end = snap(u, [22, 125]);
    expect(desc(end, 'left')).toEqual(['oneArm 40=26+14@end', 'table 32']);
    expect(desc(op.setEndCap(end, 'left', 'table'), 'left')).toEqual(['armless 40', 'table 32']);
    // pointer on the table's own spot -> nothing changes
    expect(raw.snapTable(u, t, [76, 22])).toBe(u);
  });

  it('PAIN POINT: moves are path-dependent — taking the table back out does not re-merge the split leg', () => {
    const u = U();
    const t = tableId(u);
    const mid = op.moveTable(u, t, { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) });
    const back = op.moveTable(mid, t, { run: 'back', at: 'seam', seam: 0 });
    expect(desc(back, 'back')).toEqual(desc(u, 'back')); // the back is restored...
    expect(desc(back, 'left')).toEqual(['armless 45', 'oneArm 27=13+14@end']); // ...the leg is not (was one-arm 72)
    // undo (restoring the earlier config) is the only exact way back
    expect(desc(u, 'left')).toEqual(['oneArm 72=58+14@end']);
  });

  it('PAIN POINT: seam drags must use the cumulative dx from the gesture start (per-event 0.5" snapping drifts)', () => {
    const s = standardU({ W: 272 }); // back [T][60 g][60 g]
    let inc = s;
    for (let k = 0; k < 10; k++) inc = raw.dragSeam(inc, 'back', 2, 0.3); // ten pointer events of 0.3"
    const cumulative = op.dragSeam(s, 'back', 2, 3);
    expect(desc(cumulative, 'back')).toEqual(['table 32', 'armless 63', 'armless 57']);
    expect(desc(inc, 'back')).toEqual(['table 32', 'armless 65', 'armless 55']);
  });
});
