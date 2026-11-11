import { describe, expect, it } from 'vitest';
import { DEFAULT_DIMS } from '@/engine';
import { sideSection } from './sideSection';

describe('the side drawing (plan Q78)', () => {
  it("has Andre's heights: 1″ leg, stitch line at 9½″, 18″ seat, 23″ arm, 27″ back, 31″ back pillows", () => {
    const s = sideSection(DEFAULT_DIMS, 44);
    expect(s.heights).toEqual({ leg: 1, seat: 18, arm: 23, back: 27, pillow: 31 });
    expect(s.stitch).toBe(9.5);
    expect(s.stitch - s.seat.z0).toBe(s.seat.z1 - s.stitch); // the exact middle of the one-piece seat
    expect(s.stitch).toBe(DEFAULT_DIMS.deckHeight); // the 3D seam is the same line
  });

  it('the usable seat is the depth less 18″ (the 10″ back and the 8″ pillow)', () => {
    for (const [D, usable] of [[44, 26], [40, 22], [36, 18]] as const) {
      const s = sideSection(DEFAULT_DIMS, D);
      expect(s.usableSeat).toBe(usable);
      expect(s.D).toBe(D);
      expect(s.seat.t1 - s.seat.t0).toBe(D - 10);
      expect(s.back).toMatchObject({ t0: 0, t1: 10, z0: 1, z1: 27 });
      expect(s.pillow).toMatchObject({ t0: 10, t1: 18, z0: 18, z1: 31 });
    }
  });

  it('the legs stand under the sofa, on the floor', () => {
    const s = sideSection(DEFAULT_DIMS, 36);
    for (const l of s.legs) {
      expect(l.z0).toBe(0);
      expect(l.z1).toBe(1);
      expect(l.t0).toBeGreaterThanOrEqual(0);
      expect(l.t1).toBeLessThanOrEqual(36);
    }
  });
});
