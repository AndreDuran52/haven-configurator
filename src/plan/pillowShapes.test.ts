// Phase 3b (Andre, 2026-11-08): pillows in the plan, from the same anchors as
// the 3D. Seen from above: squares as turned rounded rectangles, balls as
// circles, each inside the sofa's outline.
import { describe, expect, it } from 'vitest';
import { BALL_PILLOW, buildHaven, pillowAnchors, standardStraight, standardU } from '@/engine';
import { planPillows } from './pillowShapes';

describe('plan pillows', () => {
  it('one shape per 3D pillow: the Standard U has 8 squares and 2 balls', () => {
    const b = buildHaven(standardU());
    const p = planPillows(b);
    expect(p.map((x) => x.key)).toEqual(pillowAnchors(b).map((a) => a.key));
    expect(p.filter((x) => x.kind === 'square')).toHaveLength(8);
    const balls = p.filter((x) => x.kind === 'ball');
    expect(balls).toHaveLength(2);
    for (const x of balls) expect([x.w, x.d]).toEqual([BALL_PILLOW, BALL_PILLOW]);
  });

  it('a square is about 20″ across and 12–17″ deep from above, inside the sofa', () => {
    for (const c of [standardU(), standardStraight()]) {
      const b = buildHaven(c);
      for (const x of planPillows(b).filter((q) => q.kind === 'square')) {
        expect(x.w).toBeGreaterThan(19);
        expect(x.w).toBeLessThan(22);
        expect(x.d).toBeGreaterThan(11);
        expect(x.d).toBeLessThan(17);
        expect(x.cx).toBeGreaterThan(b.bounds.minX);
        expect(x.cx).toBeLessThan(b.bounds.maxX);
        expect(x.cy).toBeGreaterThan(b.bounds.minY);
        expect(x.cy).toBeLessThan(b.bounds.maxY);
      }
    }
  });

  it('a square on the back run faces the room (+y), turned no more than the arm yaw', () => {
    const b = buildHaven(standardStraight());
    for (const x of planPillows(b)) expect(Math.abs(x.angle)).toBeLessThanOrEqual(16);
  });
});
