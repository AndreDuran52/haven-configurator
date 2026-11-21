import { describe, expect, it } from 'vitest';
import type { Pt } from '@/engine';
import { blockRings, upholsteredBlock, wallSetIn, type Edges } from './block';
import { UPHOLSTERY, WOOD_EASE } from './parts';

const rect: Pt[] = [[0, 0], [36, 0], [36, 36], [0, 36]];
const SEAT: Edges = { ...UPHOLSTERY, seamAt: 9.5 };

/** Distance from a point to a convex polygon's nearest edge: positive inside. */
function inside(poly: Pt[], [x, y]: Pt): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) area += poly[i]![0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * poly[i]![1];
  return Math.min(
    ...poly.map(([x0, y0], i) => {
      const [x1, y1] = poly[(i + 1) % poly.length]!;
      return (Math.sign(area) * ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0))) / Math.hypot(x1 - x0, y1 - y0);
    }),
  );
}

/** How far a ring's y = 0 face is in from the footprint (the face runs between its corner arcs' ends). */
const faceIn = (pts: Pt[]) => Math.min(...pts.map((p) => p[1]));
const ringAt = (rings: ReturnType<typeof blockRings>, z: number) => rings.reduce((m, r) => (Math.abs(r.z - z) < Math.abs(m.z - z) ? r : m));

describe('the upholstered block (Andre, 2026-11-20)', () => {
  it('stays inside its footprint and between z0 and z1', () => {
    for (const e of [SEAT, { top: 1, corner: 0.75, bottom: 0.5 }, { top: WOOD_EASE, corner: WOOD_EASE, bottom: WOOD_EASE }]) {
      for (const r of blockRings(rect, 1, 18, e)) {
        expect(r.z).toBeGreaterThanOrEqual(1);
        expect(r.z).toBeLessThanOrEqual(18);
        for (const p of r.pts) expect(inside(rect, p)).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it('one seat, two puffed halves: each half reaches the footprint at its fullest, puff in at the ends, puff + pinch at the stitching', () => {
    const rings = blockRings(rect, 1, 18, SEAT);
    expect(faceIn(ringAt(rings, (1 + 9.5) / 2).pts)).toBeLessThan(0.01);
    expect(faceIn(ringAt(rings, (9.5 + 18) / 2).pts)).toBeLessThan(0.01);
    expect(faceIn(ringAt(rings, 9.5).pts)).toBeCloseTo(UPHOLSTERY.puff + UPHOLSTERY.pinch, 9);
    expect(wallSetIn(9.5 - 0.6, 1, 18, SEAT)).toBeLessThan(UPHOLSTERY.puff);
    expect(wallSetIn(9.5 + 0.6, 1, 18, SEAT)).toBeLessThan(UPHOLSTERY.puff);
    // A stitch line, not a groove: the pinch is gone ½″ from the seam.
    expect(wallSetIn(9.5 + 0.5, 1, 18, SEAT) - wallSetIn(9.5 + 0.5, 1, 18, { ...SEAT, pinch: 0 })).toBeCloseTo(0, 9);
  });

  it('the edges: top, bottom and vertical-corner radii as given', () => {
    const e: Edges = { top: 1, corner: 0.75, bottom: 0.5 };
    const rings = blockRings(rect, 1, 18, e);
    // The bottom and top rings sit in by their radius; the wall in between is the footprint.
    expect(faceIn(rings[0]!.pts)).toBeCloseTo(0.5, 9);
    expect(rings[0]!.z).toBe(1);
    expect(faceIn(rings[rings.length - 1]!.pts)).toBeCloseTo(1, 9);
    expect(rings[rings.length - 1]!.z).toBe(18);
    const wall = rings.find((r) => r.z === 1.5)!;
    expect(faceIn(wall.pts)).toBeCloseTo(0, 9);
    // The corner at (0, 0) rounds to ¾″: its arc keeps ¾″ from the centre (0.75, 0.75).
    for (const p of wall.pts.filter((q) => q[0] < 0.75 && q[1] < 0.75)) expect(Math.hypot(p[0] - 0.75, p[1] - 0.75)).toBeCloseTo(0.75, 9);
  });

  it('flat faces without puff: every wall ring is the footprint', () => {
    const rings = blockRings(rect, 1, 16, { top: 0.125, corner: 0.75, bottom: 0.5 });
    for (const r of rings.filter((q) => q.z >= 1.5 && q.z <= 16 - 0.125)) expect(faceIn(r.pts)).toBeCloseTo(0, 9);
  });

  it('the seam between neighbours: above the stitching the block takes its upper footprint, below it the whole one', () => {
    const upper: Pt[] = [[0.125, 0], [35.875, 0], [35.875, 36], [0.125, 36]];
    const rings = blockRings(rect, 1, 18, SEAT, upper);
    const minX = (z: number) => Math.min(...ringAt(rings, z).pts.map((p) => p[0]));
    expect(minX(5.25)).toBeLessThan(0.01);
    expect(minX((9.5 + 18) / 2)).toBeCloseTo(0.125, 2);
  });

  it('a wedge seat works in both windings, and the geometry has normals and UVs in inches', () => {
    const wedge: Pt[] = [[8, 8], [60, 8], [60, 44], [44, 60], [8, 60]];
    for (const poly of [wedge, [...wedge].reverse()]) {
      const geo = upholsteredBlock(poly, 1, 18, SEAT);
      const box = geo.boundingBox!;
      const got = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
      [8, 1, 8, 60, 18, 60].forEach((v, i) => expect(got[i]).toBeCloseTo(v, 3));
      const n = geo.getAttribute('normal');
      const pos = geo.getAttribute('position');
      // Outward: the normals at the footprint's x = 8 face point to −x.
      let checked = 0;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i) - 8) < 1e-3 && pos.getZ(i) > 8.5 && pos.getZ(i) < 59.5) {
          expect(n.getX(i)).toBeLessThan(-0.5);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
      const uv = geo.getAttribute('uv');
      let maxU = 0;
      for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i));
      expect(maxU).toBeGreaterThan(150); // the perimeter, in inches
      geo.dispose();
    }
  });
});
