// Pillows in the plan (Phase 3b; Andre, 2026-11-09): from the same anchors as
// the 3D, each square drawn as the model's own top-down outline (about 20 ×
// 14″ leaning on the back cushion, not a 20″ square), each ball a circle at
// its true size, each inside the sofa's outline.
import { describe, expect, it } from 'vitest';
import { BALL_PILLOW, buildHaven, pillowAnchors, SQUARE_PILLOW, standardStraight, standardU } from '@/engine';
import { PILLOW_OUTLINE } from './pillowOutline';
import { planPillows } from './pillowShapes';

const extent = (pts: readonly (readonly [number, number])[], k: 0 | 1) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]));

describe('plan pillows', () => {
  it('the baked outline: 20″ across, about 14″ deep from above, inside the leaning box', () => {
    expect(extent(PILLOW_OUTLINE, 0)).toBeCloseTo(SQUARE_PILLOW.w, 1);
    const deep = extent(PILLOW_OUTLINE, 1);
    const lean = (SQUARE_PILLOW.lean * Math.PI) / 180;
    expect(deep).toBeGreaterThan(12);
    expect(deep).toBeLessThanOrEqual(SQUARE_PILLOW.t * Math.cos(lean) + SQUARE_PILLOW.h * Math.sin(lean) + 0.01);
  });

  it('one shape per 3D pillow: the Standard U has 8 squares and 2 balls at their true size', () => {
    const b = buildHaven(standardU());
    const p = planPillows(b);
    expect(p.map((x) => x.key)).toEqual(pillowAnchors(b).map((a) => a.key));
    expect(p.filter((x) => x.kind === 'square')).toHaveLength(8);
    const balls = p.filter((x) => x.kind === 'ball');
    expect(balls).toHaveLength(2);
    for (const x of balls) expect(x.r).toBe(BALL_PILLOW / 2);
  });

  it('each square is the outline turned to its facing, at its anchor, inside the sofa', () => {
    for (const c of [standardU(), standardStraight()]) {
      const b = buildHaven(c);
      const anchors = pillowAnchors(b);
      for (const x of planPillows(b).filter((q) => q.kind === 'square')) {
        expect(x.points).toHaveLength(PILLOW_OUTLINE.length);
        const a = anchors.find((q) => q.key === x.key)!;
        // Turned, not stretched: every point keeps its distance from the anchor.
        PILLOW_OUTLINE.forEach(([s, f], i) => expect(Math.hypot(x.points[i]![0] - a.x, x.points[i]![1] - a.y)).toBeCloseTo(Math.hypot(s, f), 2));
        for (const [px, py] of x.points) {
          expect(px).toBeGreaterThanOrEqual(b.bounds.minX);
          expect(px).toBeLessThanOrEqual(b.bounds.maxX);
          expect(py).toBeGreaterThanOrEqual(b.bounds.minY);
          expect(py).toBeLessThanOrEqual(b.bounds.maxY);
        }
      }
    }
  });
});
