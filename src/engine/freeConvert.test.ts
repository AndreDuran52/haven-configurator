// Freeform stage 3: "Move pieces freely" keeps every piece where it was.
// toFree of each standard fixture and of the client's T gives, piece for piece,
// the same world outlines, arms, back frames and cushions as today's build, and
// the same seat count.
import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { standardL, standardU } from './defaults';
import { buildFree } from './freeBuild';
import { toFree } from './freeConvert';
import { buildLayout } from './layoutBuild';
import { solo } from './layoutOps';
import type { Layout } from './layoutTypes';
import { teeLayout } from './tee';
import { fixtures, kitchenSink } from './testing';
import type { BuiltPiece, Pt, Rect } from './types';

/** An outline as a sorted set of points (start vertex and winding don't matter). */
const pts = (poly: Pt[]) => poly.map(([x, y]) => `${x + 0},${y + 0}`).sort().join(' ');
const rect = (r: Rect | null | undefined) => (r ? `${r.x + 0},${r.y + 0},${r.w + 0},${r.h + 0}` : '-');
const sig = (p: BuiltPiece, o: Pt = [0, 0]) => {
  const sh = (r: Rect | null | undefined) => (r ? { ...r, x: r.x + o[0], y: r.y + o[1] } : r);
  return [p.kind, pts(p.polygon.map(([x, y]) => [x + o[0], y + o[1]] as Pt)), rect(sh(p.arm?.rect)), p.arm?.facing ?? '-', p.backs.map((b) => rect(sh(b))).sort().join('|'), rect(sh(p.cushionRect))].join(' ');
};

/** Today's world pieces of a layout (sofa only), as signatures. */
function today(l: Layout): string[] {
  const lb = buildLayout(l);
  return lb.sections.flatMap((s) => s.built.pieces.filter((p) => p.run !== null || p.corner !== null).map((p) => sig(p, s.offset))).sort();
}

const fixtureLayouts = (): Record<string, Layout> => ({
  ...Object.fromEntries(
    Object.entries(fixtures())
      .filter(([, c]) => buildHaven(c).gaps.length === 0)
      .map(([k, c]) => [k, solo(c)]),
  ),
  kitchenSink: solo(kitchenSink()),
  standardU: solo(standardU()),
  Lleft: solo(standardL('left')),
  Lright: solo(standardL('right')),
  Lleft36: solo(standardL('left', { D: 36 })),
  Tshared: teeLayout({ total: 229, stem: 110, sharedBack: true }),
  Ttwo: teeLayout({ total: 229, stem: 110, sharedBack: false }),
});

describe('toFree keeps every piece where it was', () => {
  for (const [name, l] of Object.entries(fixtureLayouts())) {
    it(name, () => {
      const r = toFree(l);
      expect(r.rejected).toBeNull();
      const fb = buildFree(r.free!);
      expect(fb.errors).toEqual([]);
      const free = fb.pieces.filter((p) => p.kind !== 'ottoman' && p.kind !== 'coffeeTable').map((p) => sig(p)).sort();
      expect(free).toEqual(today(l));
      expect(fb.seats).toEqual(buildLayout(l).seats);
      expect(fb.groups).toHaveLength(1);
    });
  }

  it('a layout with an unfilled gap is refused', () => {
    const gappy = Object.values(fixtures()).find((c) => buildHaven(c).gaps.length > 0)!;
    expect(toFree(solo(gappy)).rejected?.message).toBe('Fill the gaps first');
  });
});
