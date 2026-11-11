import { describe, expect, it } from 'vitest';
import { bodySizes, feetInches, LOUNGE_SLOUCH, parseHeight, PERSON_HEIGHT, personFigure } from './person';

const seat = (D: number) => ({ seatHeight: 18, pillowFront: 18, D });

describe('the person (plan Q79)', () => {
  it("the average US man, 5'9″: the body numbers", () => {
    expect(PERSON_HEIGHT).toBe(69);
    expect(bodySizes(69)).toEqual({ sittingHeight: 35.9, shoulderHeight: 23.5, thigh: 19.7, buttockKnee: 23.8, lowerLeg: 17.1, foot: 10.5, head: 9 });
  });

  it('the body scales with the height', () => {
    const a = bodySizes(60);
    const b = bodySizes(76);
    for (const k of Object.keys(a) as (keyof typeof a)[]) expect(b[k]).toBeGreaterThan(a[k]);
    expect(b.thigh / a.thigh).toBeCloseTo(76 / 60, 1);
  });

  it('sits on the seat: the hips above it, the torso resting on it, the head on top', () => {
    for (const pose of ['lounge', 'upright'] as const) {
      for (const D of [36, 40, 44]) {
        const f = personFigure(69, pose, seat(D));
        expect(f.hip[1]).toBeCloseTo(18 + f.thick.thigh / 2, 5);
        expect(f.pelvis[1] - f.thick.torso / 2).toBeCloseTo(18, 5);
        expect(f.top).toBeGreaterThan(18 + 30);
        expect(f.top).toBeLessThan(18 + 36.5);
        expect(f.seatBack).toBeGreaterThanOrEqual(18);
      }
    }
  });

  it('Lounge at 44″ deep: the seat is deeper than the thigh, so the legs rest out over the edge', () => {
    const f = personFigure(69, 'lounge', seat(44));
    expect(f.seatBack).toBe(18 + LOUNGE_SLOUCH);
    expect(f.feetOnFloor).toBe(false);
    expect(f.pillow).toBeNull();
    expect(f.ankle[1]).toBeGreaterThan(5);
  });

  it('Lounge at 36″ deep: the knees bend at the front edge and the feet are on the floor', () => {
    const f = personFigure(69, 'lounge', seat(36));
    expect(f.feetOnFloor).toBe(true);
    expect(f.knee[0]).toBeGreaterThan(36);
    expect(f.toe[1] - f.thick.foot / 2).toBeCloseTo(0, 5);
  });

  it('Upright at 44″ deep: a square pillow behind the back moves the hips forward; feet on the floor', () => {
    const lounge = personFigure(69, 'lounge', seat(44));
    const f = personFigure(69, 'upright', seat(44));
    expect(f.pillow).not.toBeNull();
    expect(f.pillow!.t0).toBe(18);
    expect(f.pillow!.t1).toBeCloseTo(f.seatBack, 5);
    expect(f.pillow!.z1 - f.pillow!.z0).toBe(20);
    expect(f.seatBack - 18).toBeCloseTo(26 - 19.7 - 1, 5); // the gap the pillow fills
    expect(f.hip[0]).toBeGreaterThan(lounge.hip[0]);
    expect(f.feetOnFloor).toBe(true);
    // The knee bends just past the front edge.
    expect(f.seatBack + f.sizes.thigh).toBeCloseTo(44 - 1, 5);
  });

  it('Upright at 36″ deep: no room for the extra pillow, and none is needed', () => {
    const f = personFigure(69, 'upright', seat(36));
    expect(f.pillow).toBeNull();
    expect(f.seatBack).toBe(18);
    expect(f.feetOnFloor).toBe(true);
  });

  it('a taller person sits taller; a short one on a deep seat does not reach the floor', () => {
    expect(personFigure(76, 'upright', seat(40)).top).toBeGreaterThan(personFigure(62, 'upright', seat(40)).top);
    expect(personFigure(54, 'lounge', seat(36)).feetOnFloor).toBe(false);
  });

  it('heights read and parse as feet and inches', () => {
    expect(feetInches(69)).toBe("5'9″");
    expect(feetInches(72)).toBe("6'0″");
    expect(parseHeight("5'9")).toBe(69);
    expect(parseHeight("5'9″")).toBe(69);
    expect(parseHeight('6 2')).toBe(74);
    expect(parseHeight('6ft')).toBe(72);
    expect(parseHeight('69')).toBe(69);
    expect(parseHeight('69 in')).toBe(69);
    expect(parseHeight('tall')).toBeNull();
  });
});
