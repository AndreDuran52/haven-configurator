import { describe, expect, it } from 'vitest';
import { standardL, standardU } from './defaults';
import { valid, op, U, desc, piece, codes, raw } from './testing';

describe('auto-split and re-merge', () => {
  it('uneven splits at 0.5" resolution: remainder half-inches go to the run start', () => {
    expect(desc(standardU({ W: 301 }), 'back')).toEqual(['table 32', 'armless 74.5', 'armless 74.5']); // 149 divides at 0.5
    expect(desc(standardU({ W: 300.5 }), 'back')).toEqual(['table 32', 'armless 74.5', 'armless 74']);
    expect(desc(standardU({ W: 369 }), 'back')).toEqual(['table 32', 'armless 72.5', 'armless 72.5', 'armless 72']);
  });

  it('one-arm over 108: the arm stays on the open-end piece and is EXTRA to equal cushions', () => {
    // 130 = 116 cushion + 14 arm -> cushions 58 / 58 -> [58][72]
    expect(desc(standardU({ L: 190 }), 'left')).toEqual(['armless 58', 'oneArm 72=58+14@end']);
    // 216 = 202 + 14: two pieces would need 101 + 14 = 115 > 108, so three: 67.5 / 67.5 / 67 (+14)
    expect(desc(standardU({ R: 276 }), 'right')).toEqual(['armless 67.5', 'armless 67.5', 'oneArm 81=67+14@end']);
    // arm at the run START (L-right back): the odd half-inch goes to the piece away from the arm
    expect(desc(standardL('right', { W: 190.5 }), 'back')).toEqual(['oneArm 72=58+14@start', 'armless 58.5']);
  });

  it('a split group re-merges when the run shrinks, and re-splits on the way back', () => {
    const u = U();
    const big = op.setMeasurements(u, { W: 300 });
    const back = op.setMeasurements(big, { W: 188 });
    expect(back.runs.back).toStrictEqual(u.runs.back); // same pieces, same ids
    expect(desc(op.setMeasurements(back, { W: 300 }), 'back')).toEqual(['table 32', 'armless 74', 'armless 74']);
    // growth inside the group stays equal: W 300 -> 310
    expect(desc(op.setMeasurements(big, { W: 310 }), 'back')).toEqual(['table 32', 'armless 79', 'armless 79']);
  });

  it('a manual seam drag dissolves the group; user-owned pieces never re-merge', () => {
    const big = standardU({ W: 300 });
    const dragged = op.dragSeam(big, 'back', 2, 10);
    expect(desc(dragged, 'back')).toEqual(['table 32', 'armless 84', 'armless 64']);
    expect(dragged.runs.back!.some((p) => p.splitGroup)).toBe(false);
    // W 300 -> 250: -25 at each wedge end, each absorbed by the seat nearest that end
    expect(desc(op.setMeasurements(dragged, { W: 250 }), 'back')).toEqual(['table 32', 'armless 59', 'armless 39']);
  });
});

describe('wedge slider', () => {
  it('manual C sticks when D changes until "Reset wedge"', () => {
    const a = op.setWedge(U(), 55);
    const b = op.setMeasurements(a, { D: 36 });
    const bb = valid(b);
    expect(bb.wedge).toMatchObject({ C: 55, auto: false, readout: 'Wedge 55 × 55 · angled face 26.9"' });
    expect(desc(b, 'left')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(b, 'back')).toEqual(['table 32', 'armless 46']);
    const c = op.resetWedge(b);
    expect(valid(c).wedge).toMatchObject({ C: 52, auto: true });
    expect(desc(c, 'left')).toEqual(['oneArm 80=66+14@end']);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 52']);
  });

  it('a manual C outside the new D..D+30 range is clamped (and stays manual)', () => {
    const d = op.setWedge(U(), 74);
    expect(desc(d, 'back')).toEqual(['table 32', 'armless 8']);
    const e = op.setMeasurements(d, { D: 40 });
    expect(e.wedgeC).toBe(70);
    expect(desc(e, 'left')).toEqual(['oneArm 62=48+14@end']);
    expect(desc(e, 'back')).toEqual(['table 32', 'armless 16']);
  });

  it('snaps to 1", clamps to D..D+30; square corner has no angled-face warning, < 8" does', () => {
    const u = U();
    expect(op.setWedge(u, 55.4).wedgeC).toBe(55);
    expect(op.setWedge(u, 100).wedgeC).toBe(74);
    const sq = op.setWedge(u, 30);
    const b = valid(sq);
    expect(sq.wedgeC).toBe(44);
    expect(piece(b, 'wedge:backLeft').polygon).toEqual([[0, 0], [44, 0], [44, 44], [0, 44]]);
    expect(b.wedge.face).toBe(0);
    expect(codes(b)).not.toContain('wedgeFaceUnder8');
    expect(codes(valid(op.setWedge(u, 49)))).toContain('wedgeFaceUnder8'); // 5 * sqrt2 = 7.1
    const same = op.setWedge(u, 55);
    expect(raw.setWedge(same, 55)).toBe(same);
  });
});
