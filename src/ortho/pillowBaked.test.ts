// Andre's karate-chop pillow, baked from his Blender file for the plan and the
// Side drawing (scripts/pillow-outline.mjs; Andre, 2026-11-18).
import { describe, expect, it } from 'vitest';
import { SQUARE_PILLOW } from '@/engine';
import { PILLOW_BAKED } from './pillowBaked';
import { pillowProfile } from './pillowShape';

const extent = (xs: readonly number[]) => Math.max(...xs) - Math.min(...xs);

describe('the baked karate-chop pillow', () => {
  it('was baked at the size the app uses (re-run scripts/pillow-outline.mjs after changing SQUARE_PILLOW or the model)', () => {
    expect([PILLOW_BAKED.w, PILLOW_BAKED.h, PILLOW_BAKED.t, PILLOW_BAKED.lean]).toEqual([SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t, SQUARE_PILLOW.lean]);
  });

  it('from the side it is t thick at its fullest and h tall, the front ahead of the back at every height', () => {
    const { y, front, back } = PILLOW_BAKED.side;
    expect(Math.max(...front) - Math.min(...back)).toBeCloseTo(SQUARE_PILLOW.t, 1);
    expect(extent(y)).toBeCloseTo(SQUARE_PILLOW.h, 6);
    front.forEach((f, i) => expect(f).toBeGreaterThan(back[i]!));
  });

  it('has the chop: the top is 2–4″ lower in the middle than at its ears', () => {
    const dip = PILLOW_BAKED.chop.ears - PILLOW_BAKED.chop.middle;
    expect(dip).toBeGreaterThan(2);
    expect(dip).toBeLessThan(4);
  });

  it("the Side drawing's profile: a closed loop in the box; a back leaning on it presses only the front", () => {
    const { h, t } = SQUARE_PILLOW;
    const free = pillowProfile(h, t);
    const pressed = pillowProfile(h, t, { depth: 2, at: -0.1 });
    expect(free).toHaveLength(PILLOW_BAKED.side.y.length * 2);
    for (const [z, y] of free) {
      expect(Math.abs(z)).toBeLessThanOrEqual(t / 2 + 1e-9);
      expect(Math.abs(y)).toBeLessThanOrEqual(h / 2 + 1e-9);
    }
    const n = PILLOW_BAKED.side.y.length;
    const mid = PILLOW_BAKED.side.y.findIndex((v) => v > -2.5);
    expect(free[mid]![0] - pressed[mid]![0]).toBeGreaterThan(1);
    // The back panel is not touched.
    for (let i = n; i < 2 * n; i++) expect(pressed[i]).toEqual(free[i]);
    // Scaled to another size, it keeps its shape.
    const big = pillowProfile(h * 1.1, t * 1.5);
    expect(big[mid]![1]).toBeCloseTo(free[mid]![1] * 1.1, 9);
  });
});
