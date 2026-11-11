import { describe, expect, it } from 'vitest';
import { bodySizes, feetInches, parseHeight, PERSON_HEIGHT, personFigure } from './person';

const seat = (D: number) => ({ seatHeight: 18, pillowFront: 18, pillowTop: 31, D });

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

  it('feet flat on the floor at every height, depth and pose (Andre, 2026-11-11)', () => {
    for (let h = 54; h <= 80; h += 2)
      for (const D of [36, 40, 44])
        for (const pose of ['lounge', 'upright'] as const) {
          const f = personFigure(h, pose, seat(D));
          expect(f.feetOnFloor).toBe(true);
          expect(f.toe[1] - f.thick.foot / 2).toBeCloseTo(0, 5);
          expect(f.ankle[1]).toBeLessThan(4);
          expect(f.ankle[0]).toBeGreaterThan(D); // the lower leg stands in front of the seat
        }
  });

  it('the knees bend at the front edge whenever the seat is as deep as the thigh', () => {
    for (let h = 60; h <= 76; h += 2)
      for (const D of [40, 44]) {
        const f = personFigure(h, 'lounge', seat(D));
        if (D - 18 < f.sizes.thigh) continue;
        const kneeBack = f.knee[0] - (f.sizes.buttockKnee - f.sizes.thigh) / 2;
        expect(Math.abs(kneeBack - (D - 1))).toBeLessThanOrEqual(1);
      }
  });

  it('sits on the seat: the hips above it, the head on top', () => {
    for (const pose of ['lounge', 'upright'] as const)
      for (const D of [36, 40, 44]) {
        const f = personFigure(69, pose, seat(D));
        expect(f.hip[1]).toBeGreaterThan(18);
        expect(f.hip[1]).toBeLessThan(21);
        expect(f.top).toBeGreaterThan(18 + 26);
        expect(f.top).toBeLessThan(18 + 36.5);
        expect(f.seatBack).toBeGreaterThan(18 - 2 - 1e-9); // into the back pillow's soft bottom, no further
      }
  });

  it('Lounge reclines onto the back pillow, more on a deeper sofa (5\'10″ on 44″: about 37°, as in the showroom photo)', () => {
    const lean = (D: number) => personFigure(70, 'lounge', seat(D)).lean;
    expect(lean(36)).toBeLessThan(lean(40));
    expect(lean(40)).toBeLessThan(lean(44));
    expect(lean(44)).toBeGreaterThanOrEqual(35);
    expect(lean(44)).toBeLessThanOrEqual(40);
    expect(personFigure(70, 'lounge', seat(44)).pillow).toBeNull();
  });

  it('Upright at 44″: a square pillow behind the back, the same hips, a straight back and a higher head', () => {
    const lounge = personFigure(70, 'lounge', seat(44));
    const f = personFigure(70, 'upright', seat(44));
    expect(f.pillow).not.toBeNull();
    expect(f.pillow!.t0).toBe(18);
    expect(f.pillow!.t1 - f.pillow!.t0).toBeGreaterThanOrEqual(4);
    expect(f.pillow!.t1 - f.pillow!.t0).toBeLessThanOrEqual(9);
    expect(f.pillow!.z1 - f.pillow!.z0).toBe(20);
    expect(f.hip[0]).toBeCloseTo(lounge.hip[0], 5);
    expect(f.lean).toBeLessThan(10);
    expect(f.top).toBeGreaterThan(lounge.top + 3);
  });

  it('Upright at 40″: a 4″ pillow still sits the back up; at 36″ the back is upright already and no pillow is needed', () => {
    const at40 = personFigure(70, 'upright', seat(40));
    expect(at40.pillow).not.toBeNull();
    expect(at40.lean).toBeLessThan(10);
    const at36 = personFigure(70, 'upright', seat(36));
    expect(at36.pillow).toBeNull();
    expect(at36.lean).toBeLessThan(12);
  });

  it('the back curves as it reclines; the spine runs from the hip to the shoulder at the torso\'s length', () => {
    for (const pose of ['lounge', 'upright'] as const) {
      const f = personFigure(70, pose, seat(44));
      expect(f.spine[0]).toEqual(f.hip);
      expect(f.spine[f.spine.length - 1]).toEqual(f.shoulder);
      const len = f.spine.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - f.spine[i]![0], p[1] - f.spine[i]![1]), 0);
      const torso = f.sizes.shoulderHeight - (f.hip[1] - 18);
      expect(Math.abs(len - torso) / torso).toBeLessThan(0.03);
    }
    // The bow: the middle of a reclined spine lies behind the straight line from hip to shoulder.
    const f = personFigure(70, 'lounge', seat(44));
    const [a, b] = [f.spine[0]!, f.spine[f.spine.length - 1]!];
    const mid = f.spine[Math.floor(f.spine.length / 2)]!;
    const side = (b[0] - a[0]) * (mid[1] - a[1]) - (b[1] - a[1]) * (mid[0] - a[0]);
    expect(side).toBeGreaterThan(0);
  });

  it('a taller person sits taller', () => {
    expect(personFigure(76, 'upright', seat(40)).top).toBeGreaterThan(personFigure(62, 'upright', seat(40)).top);
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
