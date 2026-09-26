import { describe, expect, it } from 'vitest';
import { buildHaven, standardL, standardU, type BuildResult, type Pt } from '@/engine';
import { buildParts, LEG_INSET } from './parts';

const built = buildHaven(standardU());
const kindOf = (b: BuildResult, id: string) => b.pieces.find((q) => q.id === id)?.kind;
const bbox = (poly: Pt[]) => [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1]))];

/** Distance from a point inside a convex polygon to its nearest edge. */
function edgeDistance(poly: Pt[], [x, y]: Pt): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) area += poly[i]![0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * poly[i]![1];
  return Math.min(
    ...poly.map(([x0, y0], i) => {
      const [x1, y1] = poly[(i + 1) % poly.length]!;
      return (Math.sign(area) * ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0))) / Math.hypot(x1 - x0, y1 - y0);
    }),
  );
}

describe('table style (Andre, 2026-09-26/27): the top flush with the seat', () => {
  const tableParts = (style: 'standard' | 'allWood') => buildParts(built, style).prisms.filter((p) => kindOf(built, p.pieceId) === 'table');

  it('standard: a 2″ wood top on a fabric base with the seat’s seam, 1–10–16–18', () => {
    const [base, band, top] = tableParts('standard');
    expect(base).toMatchObject({ mat: 'body', z0: 1, z1: 10 });
    expect(band).toMatchObject({ mat: 'body', z0: 10, z1: 16 });
    expect(top).toMatchObject({ mat: 'wood', z0: 16, z1: 18 });
    expect(base!.poly).toEqual(top!.poly);
    expect(bbox(band!.poly)).toEqual([60.125, 0, 91.875, 44]);
  });

  it('all wood: one solid wood block, 1–18', () => {
    const parts = tableParts('allWood');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ mat: 'wood', z0: 1, z1: 18 });
  });
});

describe('the real Haven (Andre, 2026-09-27)', () => {
  const parts = buildParts(built);
  const part = (key: string) => parts.prisms.find((p) => p.key === key)!;

  it('seat pieces: a 10″ back frame 1–27, a tight seat (base 1–10, flat band 10–18, the seam between), 23″ arms', () => {
    // p2: the armless 36 on the back run, x 92..128.
    expect(part('p2:frame')).toMatchObject({ z0: 1, z1: 27, mat: 'body' });
    expect(bbox(part('p2:frame').poly)).toEqual([92, 0, 128, 10]);
    expect(part('p2:base')).toMatchObject({ z0: 1, z1: 10, mat: 'body' });
    expect(bbox(part('p2:base').poly)).toEqual([92, 10, 128, 44]);
    expect(part('p2:seat')).toMatchObject({ z0: 10, z1: 18, mat: 'cushion' });
    expect(bbox(part('p2:seat').poly)).toEqual([92.125, 10, 127.875, 44]);
    // p3: the left leg's one-arm 72, its arm at the front end (y 118..132); the frame stops at the arm.
    expect(part('p3:arm')).toMatchObject({ z0: 1, z1: 23 });
    expect(bbox(part('p3:arm').poly)).toEqual([0, 118, 44, 132]);
    expect(bbox(part('p3:frame').poly)).toEqual([0, 60, 10, 118]);
    expect(bbox(part('p3:seat').poly)).toEqual([10, 60.125, 44, 117.875]);
    // Nothing is crowned any more: every seat top is flat at 18.
    for (const p of parts.prisms.filter((q) => q.key.endsWith(':seat'))) expect(p.z1).toBe(18);
  });

  it('wedges: 10″ frames on both outside edges, the tight seat on the §8 polygon', () => {
    expect(part('wedge:backLeft:frameA').poly).toEqual([[0, 0], [60, 0], [60, 10], [0, 10]]);
    expect(part('wedge:backLeft:frameB').poly).toEqual([[0, 10], [10, 10], [10, 60], [0, 60]]);
    expect(part('wedge:backLeft:seat').poly).toEqual([[10, 10], [60, 10], [60, 44], [44, 60], [10, 60]]);
    expect(part('wedge:backLeft:base')).toMatchObject({ z0: 1, z1: 10 });
    expect(part('wedge:backLeft:seat')).toMatchObject({ z0: 10, z1: 18 });
    expect(bbox(part('wedge:backRight:seat').poly)).toEqual([128, 10, 178, 60]);
  });

  it(`legs: 1″ tall, at least ${LEG_INSET}″ in from every outside edge (barely visible)`, () => {
    for (const b of [built, buildHaven(standardL('left')), buildHaven(standardU({ D: 36 }))]) {
      const legs = buildParts(b).legs;
      expect(legs.length).toBeGreaterThan(0);
      for (const leg of legs) {
        const piece = b.pieces.find((q) => leg.key.startsWith(`${q.id}:leg`))!;
        expect(leg.h).toBe(1);
        expect(edgeDistance(piece.polygon, [leg.x, leg.y]), leg.key).toBeGreaterThanOrEqual(LEG_INSET - 1e-9);
      }
    }
  });

  it('the loose back cushions ride along as soft parts', () => {
    expect(parts.backs.map((c) => c.key)).toContain('p2:back0');
    expect(parts.prisms.some((p) => p.key.includes('Cushion') || p.key.includes('crown'))).toBe(false);
  });
});
