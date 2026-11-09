// Inside the U (Andre, Phase 3c round 2, Q75): clients ask how much room is
// between the two sides and how deep the U is. Two plain dimension lines in
// the opening: across from one side's seat front to the other's (W − 2D), near
// the open end; and from the back seat's front to the end of the shorter side
// (min(L, R) − D), a quarter of the way across so it clears the Seats label.
// Pure: added to the plan's dimension layout (drawn by DimsLayer, the same
// lines, arrows and type as every other dimension).
import type { BuildResult, Pt } from '@/engine';
import type { DimLayout } from './dims';
import { fmtIn } from './format';

/** `dims` with the U's inside width and depth added (unchanged when not a U or no opening). */
export function withInsideDims(b: BuildResult, dims: DimLayout): DimLayout {
  const o = b.opening;
  if (b.shape !== 'U' || !o || o.width <= 0 || o.depth <= 0) return dims;
  const size = dims.texts.find((t) => t.weight === 400)?.size ?? dims.texts[0]?.size ?? 3;
  const x0 = b.D;
  const x1 = b.W - b.D;
  const yEnd = b.D + o.depth;
  // The width near the open end (half way down a shallow U); the depth a quarter of the way across.
  const y = o.depth > 3 * size ? yEnd - Math.min(14, o.depth / 4) : b.D + o.depth / 2;
  const x = x0 + o.width / 4;
  const gap = size * 0.35;
  const w = (s: string) => s.length * size * 0.6;
  const text = (at: Pt, s: string, rotate: 0 | -90) => ({
    x: at[0],
    y: at[1],
    rotate,
    text: s,
    size,
    weight: 600 as const,
    box: rotate ? { x: at[0] - size, y: at[1] - w(s) / 2, w: size, h: w(s) } : { x: at[0] - w(s) / 2, y: at[1] - size, w: w(s), h: size },
  });
  const wl = fmtIn(o.width);
  const dl = fmtIn(o.depth);
  return {
    ...dims,
    lines: [...dims.lines, { a: [x0, y], b: [x1, y], kind: 'dim' }, { a: [x, b.D], b: [x, yEnd], kind: 'dim' }],
    arrows: [...dims.arrows, { tip: [x0, y], dir: [-1, 0] }, { tip: [x1, y], dir: [1, 0] }, { tip: [x, b.D], dir: [0, -1] }, { tip: [x, yEnd], dir: [0, 1] }],
    texts: [...dims.texts, text([(x0 + x1) / 2, y - gap], wl, 0), text([x - gap, b.D + o.depth / 2], dl, -90)],
  };
}
