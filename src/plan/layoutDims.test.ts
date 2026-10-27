// Shapes B1: the T's plan dimensions (client: 229 across, 110 stem, 44 deep).
import { describe, expect, it } from 'vitest';
import { buildLayout, setTeeStem, teeLayout } from '@/engine';
import { fitSource, layoutSource } from './dimLayout';
import { PRINT, soloSource } from './dims';
import { layoutDimSource } from './layoutDims';
import { buildHaven, solo, standardU } from '@/engine';

const VIEWPORTS: [number, number][] = [
  [860, 700],
  [800, 640],
  [374, 420],
];
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
const tee = (sharedBack: boolean) => buildLayout(teeLayout({ total: 229, stem: 110, D: 44, sharedBack }));

describe('T dimensions', () => {
  it('shared back: top 14 | 45.5 | 110 | 45.5 | 14, overall 229, stem 110, bays 36 | 14, stem width 78, 44"D at each wing', () => {
    const { layout } = fitSource(layoutDimSource(tee(true)), 860, 700);
    const t = layout.texts.map((x) => x.text);
    expect(t).toEqual(expect.arrayContaining([`229" (19'-1")`, `110" (9'-2")`, '110"', '45½"', '78"']));
    expect(t.filter((x) => x === '44"D')).toHaveLength(2);
    expect(t.filter((x) => x === '36"')).toHaveLength(2);
    expect(t.filter((x) => x === '14"')).toHaveLength(4); // two wing arms on top, two stem-end arms in the bays
    expect(t).not.toContain('60"');
  });

  it('two backs: top 14 | 40.5 | 60 | 60 | 40.5 | 14, stem width 88', () => {
    const t = fitSource(layoutDimSource(tee(false)), 860, 700).layout.texts.map((x) => x.text);
    expect(t.filter((x) => x === '60"')).toHaveLength(2);
    expect(t).toEqual(expect.arrayContaining(['40½"', '88"', `229" (19'-1")`]));
  });

  it('uneven stem sides: both lengths shown and a depth at each stem end', () => {
    const l = setTeeStem(teeLayout({ total: 229, stem: 110 }), 110).layout;
    const r = buildLayout({ ...l, sections: [l.sections[0]!, { ...l.sections[1]!, config: { ...l.sections[1]!.config, L: 120, runs: { ...l.sections[1]!.config.runs, left: [{ ...l.sections[1]!.config.runs.left![0]!, length: 60 }] } } }] });
    const t = fitSource(layoutDimSource(r), 860, 700).layout.texts.map((x) => x.text);
    expect(t).toEqual(expect.arrayContaining([`110" (9'-2")`, `120" (10'-0")`]));
    expect(t.filter((x) => x === '44"D')).toHaveLength(4);
  });

  it('no overlapping labels and none on the sofa, both back options, 3 screen sizes and print', () => {
    for (const shared of [true, false]) {
      const lb = tee(shared);
      const src = layoutDimSource(lb);
      const pieces = lb.sections.flatMap((s) => s.built.pieces.map((p) => ({ x: p.bbox.x + s.offset[0], y: p.bbox.y, w: p.bbox.w, h: p.bbox.h })));
      for (const l of [...VIEWPORTS.map(([w, h]) => fitSource(src, w, h).layout), layoutSource(src, { ...PRINT, k: 1 / (72 * (1 / 4 / 12)) })]) {
        const boxes = l.texts.map((x) => x.box);
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!), `${l.texts[i]!.text} / ${l.texts[j]!.text}`).toBe(false);
          for (const p of pieces) expect(overlap(boxes[i]!, p), `${l.texts[i]!.text} on the sofa`).toBe(false);
        }
      }
    }
  });

  it('one sofa: the layout source is exactly today’s dimensions', () => {
    const b = buildHaven(standardU());
    const lb = buildLayout(solo(standardU()), () => b);
    expect(fitSource(layoutDimSource(lb), 860, 700)).toEqual(fitSource(soloSource(b), 860, 700));
  });
});
