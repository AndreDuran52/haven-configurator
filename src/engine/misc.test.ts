import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { standardU } from './defaults';
import { valid, op, U, idAt, tableId, codes, raw } from './testing';
import type { Config } from './types';

describe('seat count', () => {
  it('"Seats 7–8" when comfortable and snug differ; seat width is a setting', () => {
    const c = op.setMeasurements(U(), { D: 36 }); // back stretch 52: 1 @28, 2 @24
    expect(valid(c).seats).toEqual({ comfortable: 7, snug: 8, label: 'Seats 7–8' });
    expect(valid(op.setSeatWidth(c, 24)).seats.label).toBe('Seats 8');
    expect(valid(op.setSeatWidth(c, 22)).seats).toEqual({ comfortable: 10, snug: 10, label: 'Seats 10' });
  });

  it('warns on seat depth under 24', () => {
    expect(codes(valid(standardU({ D: 32 })))).toContain('seatDepthUnder24');
    expect(codes(valid(standardU({ D: 36 })))).not.toContain('seatDepthUnder24');
  });
});

describe('coffee table', () => {
  it('clearance per side; warns under 14"; the wedge angled face is measured exactly', () => {
    const c = op.addLoose(U(), 'coffeeTable');
    const id = c.loose[0]!.id;
    const b = valid(c);
    expect(c.loose[0]).toMatchObject({ x: 70, y: 64, w: 48, d: 48 });
    expect(b.clearances).toEqual([{ pieceId: id, back: 20, left: 26, right: 26, front: null, min: 20 }]);
    expect(codes(b)).not.toContain('coffeeClearanceUnder14');
    const near = valid(op.moveLoose(c, id, 70, 54));
    expect(near.clearances[0]).toMatchObject({ back: 10, min: 10 });
    expect(near.warnings.find((w) => w.code === 'coffeeClearanceUnder14')!.message).toBe(
      'Coffee table clearance 10" is under 14"',
    );
    // at (58, 58) the back seats / leg are 14" away but the wedge's angled face is 12";
    // on the right the back-right wedge's face (x = 142 at y = 58) beats the leg at x = 144
    const corner = valid(op.moveLoose(c, id, 58, 58));
    expect(corner.clearances[0]).toMatchObject({ back: 12, left: 12, right: 36, front: null });
  });
});

describe('undo / purity', () => {
  it('undo = restoring a previous config; configs are plain JSON and never mutated', () => {
    const history: Config[] = [U()];
    const snapshots: string[] = [JSON.stringify(buildHaven(history[0]!))];
    const push = (c: Config) => {
      history.push(c);
      snapshots.push(JSON.stringify(buildHaven(c)));
    };
    push(op.setWedge(history[0]!, 55));
    push(op.moveTable(history[1]!, tableId(history[1]!), { run: 'left', at: 'split', pieceId: idAt(history[1]!, 'left', 0) }));
    push(op.setMeasurements(history[2]!, { W: 300 }));
    push(op.setLock(history[3]!, false));
    push(op.resizePiece(history[4]!, idAt(history[4]!, 'back', 0), 60));
    // every earlier config still builds exactly as it did (nothing was mutated)
    history.forEach((c, i) => expect(JSON.stringify(buildHaven(c))).toBe(snapshots[i]));
    // undo x2, redo x1 = pick an index
    let cursor = history.length - 1;
    cursor -= 2;
    expect(JSON.stringify(buildHaven(history[cursor]!))).toBe(snapshots[3]);
    cursor += 1;
    expect(history[cursor]!.lockOutside).toBe(false);
    // a share-link round trip continues editing identically (ids included)
    const parsed = JSON.parse(JSON.stringify(history[2]!)) as Config;
    expect(op.setMeasurements(parsed, { W: 300 })).toStrictEqual(history[3]);
    // rejected / no-op edits hand back the same reference (UI: "nothing happened")
    expect(raw.setLock(history[0]!, true)).toBe(history[0]);
  });
});
