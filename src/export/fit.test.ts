import { describe, expect, it } from 'vitest';
import { buildHaven, standardU } from '@/engine';
import { fitPlan } from './fit';
import { SheetLayout } from './layout';

describe('sheet scale (plan §9 "Scale")', () => {
  it('Standard U alone prints at 3/8" = 1\'-0"; W 300 at 1/4"', () => {
    const plan = (c = standardU()) => fitPlan(buildHaven(c), new SheetLayout({ plan: true, views: [] }).plan!);
    expect(plan().label).toBe('SCALE 3/8" = 1\'-0"');
    expect(plan().S).toBe(2.25);
    expect(plan(standardU({ W: 300 })).label).toBe('SCALE 1/4" = 1\'-0"');
  });

  it('beside 3D views the plan still gets a standard scale, and fits its box', () => {
    const L = new SheetLayout({ plan: true, views: ['threeQuarter', 'iso'] });
    const f = fitPlan(buildHaven(standardU()), L.plan!);
    expect(f.label).toBe('SCALE 1/4" = 1\'-0"');
    const w = f.dims.bounds.w * f.S;
    expect(f.ox + f.dims.bounds.x * f.S).toBeGreaterThanOrEqual(L.plan!.x - 1e-9);
    expect(f.ox + f.dims.bounds.x * f.S + w).toBeLessThanOrEqual(L.plan!.x + L.plan!.w + 1e-9);
  });

  it('layout: views beside the plan (1 column for 2), a 2 × 2 grid for 4, full page without the plan', () => {
    expect(new SheetLayout({ plan: true, views: ['threeQuarter', 'iso'] }).cells.map((c) => Math.round(c.x))).toEqual([477, 477]);
    expect(new SheetLayout({ plan: true, views: ['threeQuarter', 'iso', 'front', 'side'] }).cells).toHaveLength(4);
    const solo = new SheetLayout({ plan: false, views: ['threeQuarter'] });
    expect(solo.plan).toBeNull();
    expect(solo.cells[0]!.w).toBe(solo.body.w);
  });
});
