import { describe, expect, it } from 'vitest';
import { standardL, standardU } from './defaults';
import { splitLengths } from './pieces';
import { codes, desc, op, piece, raw, refused, U, valid } from './testing';

describe('auto-split (G9: equal footprint, arm included)', () => {
  it('§5.4 table: 148 -> 74 + 74; 148.5 -> 74.5 + 74; 248 -> 83 + 82.5 + 82.5; one-arm 200 -> 100 + 100', () => {
    expect(splitLengths(148, null)).toEqual([74, 74]);
    expect(splitLengths(148.5, null)).toEqual([74.5, 74]);
    expect(splitLengths(248, null)).toEqual([83, 82.5, 82.5]);
    expect(splitLengths(200, 'end')).toEqual([100, 100]);
    expect(splitLengths(200.5, 'end')).toEqual([100.5, 100]); // remainder away from the arm
    expect(splitLengths(200.5, 'start')).toEqual([100, 100.5]);
    expect(splitLengths(108, null)).toEqual([108]);
  });

  it('E4 splitRemainder_W300_5: back [32][74.5][74]', () => {
    expect(desc(standardU({ W: 300.5 }), 'back')).toEqual(['table 32', 'armless 74.5', 'armless 74']);
    expect(desc(standardU({ W: 369 }), 'back')).toEqual(['table 32', 'armless 72.5', 'armless 72.5', 'armless 72']);
  });

  it('E8 oneArmAutoSplit_equalFootprint: L = 260 gives left [armless 100][one-arm 100 (86 + 14)]', () => {
    const c = standardU({ L: 260 });
    expect(desc(c, 'left')).toEqual(['armless 100', 'oneArm 100=86+14@end']);
    expect(desc(standardL('right', { W: 190.5 }), 'back')).toEqual(['oneArm 65=51+14@start', 'armless 65.5']);
    valid(c);
  });

  it('E7 splitGroup_remerges: W 300 -> 188 gives armless 36 with the original id', () => {
    const u = U();
    const big = op.setMeasurements(u, { W: 300 });
    const back = op.setMeasurements(big, { W: 188 });
    expect(back.runs.back).toStrictEqual(u.runs.back); // same pieces, same ids
    expect(desc(op.setMeasurements(big, { W: 310 }), 'back')).toEqual(['table 32', 'armless 79', 'armless 79']);
  });

  it('a manual seam drag dissolves the group; user-owned pieces never re-merge', () => {
    const big = standardU({ W: 300 });
    const dragged = op.dragSeam(big, 'back', 2, 10);
    expect(desc(dragged, 'back')).toEqual(['table 32', 'armless 84', 'armless 64']);
    expect(dragged.runs.back!.some((p) => p.splitGroup)).toBe(false);
    // -25 at each wedge end, each absorbed by the seat nearest that end
    expect(desc(op.setMeasurements(dragged, { W: 250 }), 'back')).toEqual(['table 32', 'armless 59', 'armless 39']);
  });
});

describe('measurements', () => {
  it('E3 W140_refusedWithMin158: infeasible, min.W 158, config unchanged', () => {
    const u = U();
    const r = refused(raw.setMeasurements(u, { W: 140 }), u, 'infeasible');
    expect(r.min).toEqual({ W: 158 });
    expect(r.message).toBe('Can\'t fit: min W 158″');
  });

  it('E9c D_wholeInch: typed D 40.5 is stored as 41, auto C 57; D outside 30–48 is refused', () => {
    const c = op.setMeasurements(U(), { D: 40.5 });
    expect(c.D).toBe(41);
    expect(valid(c).wedge.C).toBe(57);
    const u = U();
    refused(raw.setMeasurements(u, { D: 50 }), u, 'infeasible');
    refused(raw.setMeasurements(u, { D: 29 }), u, 'infeasible');
  });

  it('growth in a partially filled run grows the nearest existing gap (placed pieces stay)', () => {
    const b1 = op.addPiece(raw.blankConfig('U'), 'oneArm', { run: 'left', at: 'seam', seam: 1 });
    expect(desc(b1, 'left')).toEqual(['gap 22', 'oneArm 50=36+14@end']);
    expect(desc(op.setMeasurements(b1, { L: 142 }), 'left')).toEqual(['gap 32', 'oneArm 50=36+14@end']);
  });
});

describe('wedge slider', () => {
  it('E9 manualC_sticksAndClamps: C 74 at D 44 -> D 36 gives 66 (stored) -> D 44 keeps 66; reset at D 36 gives 52', () => {
    const a = op.setWedge(U(), 74);
    expect(desc(a, 'back')).toEqual(['table 32', 'armless 8']);
    const b = op.setMeasurements(a, { D: 36 });
    expect(b.wedgeC).toBe(66);
    const c = op.setMeasurements(b, { D: 44 });
    expect(c.wedgeC).toBe(66);
    const reset = op.resetWedge(b);
    expect(valid(reset).wedge).toMatchObject({ C: 52, auto: true });
    expect(desc(reset, 'left')).toEqual(['oneArm 80=66+14@end']);
  });

  it('E10 squareCorner_noFaceWarning: C = D gives no warning; C = D + 5 warns (face 7.1)', () => {
    const u = U();
    const sq = op.setWedge(u, 30); // clamps to D
    const b = valid(sq);
    expect(sq.wedgeC).toBe(44);
    expect(piece(b, 'wedge:backLeft').polygon).toEqual([[0, 0], [44, 0], [44, 44], [0, 44]]);
    expect(b.wedge.face).toBe(0);
    expect(codes(b)).not.toContain('wedgeFaceUnder8');
    const w = valid(op.setWedge(u, 49)).warnings.find((x) => x.code === 'wedgeFaceUnder8');
    expect(w!.message).toBe('Wedge angled face 7.1″ (under 8)');
  });

  it('E11 wedgeSlider_clampsToFeasible: W 160 Standard U, setWedge(74) gives C 61 (back armless 6), not refused (G3)', () => {
    const c0 = standardU({ W: 160 });
    const c = op.setWedge(c0, 74);
    expect(c.wedgeC).toBe(61);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 6']);
    expect(raw.wedgeRange(c0)).toEqual({ min: 44, max: 61 });
    expect(raw.wedgeRange(U())).toEqual({ min: 44, max: 74 });
    refused(raw.setWedge(c, 70), c, 'noRoom'); // already at the limit
  });

  it('snaps to 1" and clamps to D..D+30; the same value is a no-op', () => {
    const u = U();
    expect(op.setWedge(u, 55.4).wedgeC).toBe(55);
    expect(op.setWedge(u, 100).wedgeC).toBe(74);
    const same = op.setWedge(u, 55);
    expect(raw.setWedge(same, 55)).toEqual({ config: same, rejected: null });
  });

  it('E29 resetWedge_infeasible: W 160, setWedge(44), W 128, then resetWedge -> infeasible, min.W 158', () => {
    const a = op.setWedge(standardU({ W: 160 }), 44);
    const b = op.setMeasurements(a, { W: 128 });
    const r = refused(raw.resetWedge(b), b, 'infeasible');
    expect(r.min).toEqual({ W: 158 });
  });
});
