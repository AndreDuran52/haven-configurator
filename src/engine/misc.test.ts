import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { standardL, standardU } from './defaults';
import { profiles } from './profiles';
import { planCentre, planToWorld } from './world';
import { codes, idAt, op, piece, raw, tableId, U, valid } from './testing';
import type { Config } from './types';

describe('seat count and warnings', () => {
  it('"Seats 7–8" when comfortable and snug differ; seat width is a setting (G8 snug width too)', () => {
    const c = op.setMeasurements(U(), { D: 36 }); // back stretch 52: 1 @28, 2 @24
    expect(valid(c).seats).toEqual({ comfortable: 7, snug: 8, label: 'Seats 7–8' });
    expect(valid(op.setSeatWidth(c, 24)).seats.label).toBe('Seats 8');
    expect(valid(op.setSeatWidth(c, 22)).seats).toEqual({ comfortable: 10, snug: 10, label: 'Seats 10' });
    expect(valid({ ...c, snugWidth: 26 }).seats.label).toBe('Seats 7–8'); // 52/26 = 2
    expect(valid({ ...c, snugWidth: 28 }).seats.label).toBe('Seats 7');
  });

  it('warning messages (amber, never blocking)', () => {
    const shallow = standardU({ D: 30 });
    expect(valid(shallow).warnings.find((w) => w.code === 'seatDepthUnder24')!.message).toBe('Seat depth 20″ (under 24)');
    const narrow = op.setMeasurements(U(), { L: 100 });
    expect(valid(narrow).warnings.find((w) => w.code === 'openingUnder60')!.message).toBe('Opening 56″ deep (under 60)');
    expect(valid(narrow).exportBlocked).toBe(false);
    const wide = op.resizePiece(op.setLock(U(), false), tableId(U()), 44);
    expect(valid(wide).warnings.find((w) => w.code === 'tableOutOfRange')!.message).toBe('Table 44″ (outside 16–40)');
  });
});

describe('coffee table clearance (G7)', () => {
  it('E14 coffeeClearance_standardU: centred 48 gives back 20, left/right 26, wedge faces 21.2, min 20; 8" back warns', () => {
    const c = op.addLoose(U(), 'coffeeTable');
    const id = c.loose[0]!.id;
    expect(c.loose[0]).toMatchObject({ x: 70, y: 64, w: 48, d: 48 });
    const b = valid(c);
    expect(b.clearances).toEqual([
      { pieceId: id, back: 20, left: 26, right: 26, backLeft: 21.2, backRight: 21.2, min: 20, overlap: false },
    ]);
    expect(codes(b)).not.toContain('coffeeClearanceUnder14');
    const near = valid(op.moveLoose(c, id, 70, 56));
    expect(near.clearances[0]).toMatchObject({ back: 12, min: 12 });
    expect(near.warnings.find((w) => w.code === 'coffeeClearanceUnder14')!.message).toBe('Coffee table clearance 12″ (under 14)');
  });

  it('measures diagonally to the wedge face (a corner facing the wedge: 8.5" vs 14" straight out)', () => {
    const c = op.addLoose(U(), 'coffeeTable', { x: 58, y: 58 });
    const cl = valid(c).clearances[0]!;
    expect(cl).toMatchObject({ back: 14, left: 14, backLeft: 8.5, min: 8.5, overlap: false });
    expect(codes(valid(c))).toContain('coffeeClearanceUnder14');
    const over = valid(op.moveLoose(c, c.loose[0]!.id, 40, 70));
    expect(over.clearances[0]).toMatchObject({ left: 0, overlap: true });
    expect(codes(over)).toEqual(['coffeeOverlap']);
  });

  it('E28 coffeeDefault_noOverlap for U, L-left, L-right (pushed out to 14" when needed)', () => {
    for (const base of [U(), standardL('left'), standardL('right'), standardL('right', { W: 120, R: 100 })]) {
      const c = op.addLoose(base, 'coffeeTable');
      const cl = valid(c).clearances[0]!;
      expect(cl.overlap).toBe(false);
      expect(cl.min!).toBeGreaterThanOrEqual(14);
    }
    expect(op.addLoose(standardL('right', { W: 120, R: 100 }), 'coffeeTable').loose[0]).toMatchObject({ x: 4, y: 58 });
  });

  it('loose pieces never touch runs, W/L/R or the seat count; the coffee table stays square', () => {
    const u = U();
    const c = op.addLoose(u, 'ottoman');
    expect(c.runs).toEqual(u.runs);
    expect(valid(c).seats).toEqual(valid(u).seats);
    expect(piece(valid(c), c.loose[0]!.id).height).toBe(18);
    const t = op.addLoose(u, 'coffeeTable');
    expect(op.resizeLoose(t, t.loose[0]!.id, 40, 60).loose[0]).toMatchObject({ w: 40, d: 40 });
    expect(piece(valid(t), t.loose[0]!.id).height).toBe(16);
    expect(raw.deleteLoose(t, t.loose[0]!.id).config.loose).toEqual([]);
  });
});

describe('purity, undo and refusals (G6)', () => {
  it('undo = restoring a previous config; configs are plain JSON and never mutated', () => {
    const history: Config[] = [U()];
    const snapshots = [JSON.stringify(buildHaven(history[0]!))];
    const push = (c: Config) => {
      history.push(c);
      snapshots.push(JSON.stringify(buildHaven(c)));
    };
    push(op.setWedge(history[0]!, 55));
    push(op.moveTable(history[1]!, tableId(history[1]!), { run: 'left', at: 'split', pieceId: idAt(history[1]!, 'left', 0) }));
    push(op.setMeasurements(history[2]!, { W: 300 }));
    push(op.setLock(history[3]!, false));
    push(op.resizePiece(history[4]!, idAt(history[4]!, 'back', 0), 60));
    history.forEach((c, i) => expect(JSON.stringify(buildHaven(c))).toBe(snapshots[i]));
    const parsed = JSON.parse(JSON.stringify(history[2]!)) as Config;
    expect(op.setMeasurements(parsed, { W: 300 })).toStrictEqual(history[3]);
    expect(raw.setLock(history[0]!, true)).toEqual({ config: history[0], rejected: null });
  });

  it('limits() gives corners + tables + arms + 6" per seat unit', () => {
    expect(raw.limits(U())).toEqual({ W: 158, L: 80, R: 80 });
    expect(raw.limits(standardU({ W: 300 }))).toEqual({ W: 158, L: 80, R: 80 }); // a split group is one unit
    expect(raw.limits(standardL('right'))).toEqual({ W: 80, R: 80 });
  });
});

describe('profiles and world', () => {
  it('profiles.ts: legs 0–1, body 1–10, cushion 10 → 16 edge / 18 crown, arm 23, back 27, table 23', () => {
    const p = profiles(U().dims);
    expect(p.leg).toEqual({ z0: 0, z1: 1 });
    expect(p.body).toEqual({ z0: 1, z1: 10 });
    expect(p.seatCushion).toEqual({ t0: 10, z0: 10, edge: 16, crown: 18 });
    expect(p.backFrame).toEqual({ t0: 0, t1: 4, z0: 1, z1: 27 });
    expect(p.backCushion).toEqual({ t0: 4, t1: 10, z0: 10, z1: 26 });
    expect([p.arm.z1, p.table.z1, p.ottoman.z1, p.coffeeTable.z1]).toEqual([23, 23, 18, 16]);
  });

  it('E20a worldHandedness: planToWorld(x, y, h) = (x − cx, h, y − cy); the wedge diagonal is +X, +Z of its corner', () => {
    const b = valid(U());
    const centre = planCentre(b.bounds);
    expect(centre).toEqual({ cx: 94, cy: 66 });
    expect(planToWorld(0, 0, 27, centre)).toEqual([-94, 27, -66]);
    const corner = planToWorld(0, 0, 0, centre);
    const diag = planToWorld(52, 52, 0, centre); // midpoint of the face (60,44)-(44,60)
    expect(diag[0] - corner[0]).toBeGreaterThan(0);
    expect(diag[2] - corner[2]).toBeGreaterThan(0);
  });
});
