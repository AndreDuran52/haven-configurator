import { describe, expect, it } from 'vitest';
import { blankConfig, buildHaven, moveTable, setMeasurements, setWedge, standardL, standardU } from '@/engine';
import { fitScreen, layoutDims } from './dimLayout';
import { PRINT } from './dims';

const u = standardU();
const fixtures = {
  T1: u,
  T2: setMeasurements(u, { D: 36 }).config,
  T3b: moveTable(u, u.runs.back![0]!.id, { run: 'left', at: 'split', pieceId: u.runs.left![0]!.id }).config,
  T4: standardL('right', { W: 120, R: 100 }),
  T5: setMeasurements(u, { W: 300 }).config,
  T6: setWedge(u, 55).config,
  T8: blankConfig('U'),
  Lleft: standardL('left'),
  narrow: setMeasurements(u, { L: 100 }).config,
};
const VIEWPORTS: [number, number][] = [
  [860, 700], // iPad landscape plan area
  [800, 640], // iPad portrait plan area
  [374, 420], // phone plan area
];

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

describe('dimension layout (plan §8)', () => {
  it('Standard U: back chain 60 | 32 | 36 | 60, overall 188" (15\'-8"), legs 72, 44"D', () => {
    const { layout } = fitScreen(buildHaven(u), 860, 700);
    const texts = layout.texts.map((t) => t.text);
    expect(texts).toEqual(expect.arrayContaining(['60"', '32"', '36"', '72"', `188" (15'-8")`, '44"D']));
    expect(texts.filter((t) => t === '60"')).toHaveLength(4); // 2 wedges on the top chain, 1 on each leg chain
  });

  it('0 overlapping labels and every label outside the sofa, for every fixture at 3 plan sizes and in print', () => {
    for (const [name, c] of Object.entries(fixtures)) {
      const b = buildHaven(c);
      const layouts = [
        ...VIEWPORTS.map(([w, h]) => fitScreen(b, w, h).layout),
        layoutDims(b, { ...PRINT, k: 1 / (72 * (3 / 8 / 12)) }),
      ];
      for (const l of layouts) {
        const boxes = l.texts.map((t) => t.box);
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!), `${name}: ${l.texts[i]!.text} / ${l.texts[j]!.text}`).toBe(false);
          const sofa = { x: 0, y: 0, w: b.W, h: Math.max(b.shape !== 'L-right' ? b.L : 0, b.shape !== 'L-left' ? b.R : 0) };
          expect(overlap(boxes[i]!, sofa), `${name}: ${l.texts[i]!.text} inside the sofa`).toBe(false);
        }
      }
    }
  });

  it('the fit keeps every dimension inside the view', () => {
    for (const c of Object.values(fixtures)) {
      for (const [w, h] of VIEWPORTS) {
        const { k, layout } = fitScreen(buildHaven(c), w, h, 12);
        expect(layout.bounds.w / k).toBeLessThanOrEqual(w - 24 + 1);
        expect(layout.bounds.h / k).toBeLessThanOrEqual(h - 24 + 1);
      }
    }
  });
});
