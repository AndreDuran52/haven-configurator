// Shapes B1: the sheet for a T (plan to scale, header, file name, wrapped link).
import { describe, expect, it } from 'vitest';
import { buildHaven, buildLayout, rootConfig, solo, standardU, teeLayout } from '@/engine';
import { layoutDimSource } from '@/plan/layoutDims';
import { fitPlan, headerLine } from './fit';
import { SheetLayout, linkLines } from './layout';
import { fileName } from './pdf';

const date = new Date('2026-10-27T12:00:00Z');

describe('the sheet for a T', () => {
  for (const sharedBack of [true, false]) {
    const t = teeLayout({ total: 229, stem: 110, sharedBack });
    it(`${sharedBack ? 'shared back' : 'two backs'}: header, file name, plan to scale with every label`, () => {
      expect(headerLine(t, buildHaven(rootConfig(t)))).toBe(
        `T shape, ${sharedBack ? 'shared back' : 'two backs'}  ·  229" W x 110" stem · 44" deep · 19'-1" wide`,
      );
      expect(fileName(t, '', date, 'pdf')).toBe('Haven-T-229x110-2026-10-27.pdf');
      const box = new SheetLayout({ plan: true, views: [] }).plan!;
      const f = fitPlan(layoutDimSource(buildLayout(t)), box);
      expect(f.label).toBe(`SCALE 3/8" = 1'-0"`); // at 1/2" the 229" plan and its dims are wider than Letter
      expect(f.dims.bounds.w * f.S).toBeLessThanOrEqual(box.w);
      const texts = f.dims.texts.map((x) => x.text);
      expect(texts).toContain(`229" (19'-1")`);
      expect(texts).toContain(`110" (9'-2")`);
      expect(texts).toContain(sharedBack ? '78"' : '88"');
    });
  }

  it('one sofa keeps its header and file name', () => {
    const u = solo(standardU());
    expect(headerLine(u, buildHaven(standardU()))).toMatch(/^U shape {2}· {2}188" W x 132" L x 132" R/);
    expect(fileName(u, 'Mitchell residence', date, 'pdf')).toBe('Mitchell-residence-U-188x132x132-2026-10-27.pdf');
  });

  it('the footer link wraps and is never cut', () => {
    const link = `https://haven.example/?view#c=${'3rW119.5L110R110D44_ba59.5_ra50_PglW119.5L110R110H_ba59.5_la50.7o'}`;
    const lines = linkLines(link);
    expect(lines.join('')).toBe(link);
    expect(lines.length).toBe(2);
    expect(new SheetLayout({ plan: true, views: [] }).linkBox(link).h).toBe(24);
  });
});
