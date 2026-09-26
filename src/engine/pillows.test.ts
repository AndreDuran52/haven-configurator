import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { decode, encode, FABRIC_CODES, FINISH_CODES } from './codec';
import { standardL, standardU } from './defaults';
import { FABRICS, FINISHES } from './fabrics';
import { backCushions } from './cushions';
import { BALL_PILLOW, pillowAnchors, pillowCorners } from './pillows';
import { boxDistance, boxesClash } from './softBox';
import { setFabric, setTableFinish } from './ops';
import { moveTable } from './tableOps';
import type { Pt } from './types';

const inPoly = (pt: Pt, poly: Pt[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

describe('pillows (Q15, Andre 2026-09-26/27: like the showroom photos)', () => {
  it('Standard U: 2 squares + 1 ball at each wedge and each arm end', () => {
    const b = buildHaven(standardU());
    const a = pillowAnchors(b);
    expect(a).toHaveLength(12);
    const groups = new Map<string, string[]>();
    for (const p of a) groups.set(p.key.split(':').slice(0, -1).join(':'), [...(groups.get(p.key.split(':').slice(0, -1).join(':')) ?? []), p.kind]);
    expect(groups.size).toBe(4);
    for (const kinds of groups.values()) expect(kinds.sort()).toEqual(['ball', 'square', 'square']);
  });

  it('none at table or open ends: 3a (table in place of the left arm) loses that arm group', () => {
    const u = standardU();
    const id = u.runs.back!.find((p) => p.kind === 'table')!.id;
    const a = pillowAnchors(buildHaven(moveTable(u, id, { run: 'left', at: 'replaceArm' }).config));
    expect(a).toHaveLength(9);
  });

  it('L shapes: one wedge and two arm ends', () => {
    for (const side of ['left', 'right'] as const) expect(pillowAnchors(buildHaven(standardL(side)))).toHaveLength(9);
  });

  it('every pillow sits over the sofa (footprint), never over an arm or a table; all sit on the 18″ seat', () => {
    for (const c of [standardU(), standardL('left'), standardL('right'), standardU({ W: 300, D: 36 })]) {
      const b = buildHaven(c);
      const polys = b.pieces.filter((p) => (p.run || p.corner) && p.kind !== 'table').map((p) => p.polygon);
      const blocked = b.pieces.flatMap((p) => (p.arm ? [p.arm.rect] : p.kind === 'table' ? [p.bbox] : []));
      for (const p of pillowAnchors(b)) {
        const corners = pillowCorners(p);
        for (const [x, y] of corners) {
          expect(polys.some((poly) => inPoly([x, y], poly)), `${p.key} (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
          expect(blocked.some((r) => x > r.x + 0.01 && x < r.x + r.w - 0.01 && y > r.y + 0.01 && y < r.y + r.h - 0.01), `${p.key} over an arm or table`).toBe(false);
        }
        // Squares rest on their bottom-back edge, balls on their underside, both sunk into the seat.
        const bottom = p.kind === 'square' ? Math.min(...corners.map((q) => q[2])) : p.z - p.h / 2;
        expect(bottom, p.key).toBeCloseTo(p.kind === 'square' ? 17 : 17.5, 9);
      }
    }
  });

  it('nothing passes through anything: squares clear the back cushions and each other, balls clear both (D 30–48)', () => {
    for (const D of [30, 34, 36, 40, 44, 48]) {
      for (const c of [standardU({ D }), standardL('left', { D }), standardL('right', { D }), standardU({ W: 240, D })]) {
        const b = buildHaven(c);
        const cushions = backCushions(b);
        const all = pillowAnchors(b);
        const squares = all.filter((p) => p.kind === 'square');
        for (const p of all) {
          const others = [...cushions, ...squares.filter((q) => q !== p)];
          if (p.kind === 'square') for (const o of others) expect(boxesClash(p, o), `D${D} ${p.key} × ${'key' in o ? o.key : ''}`).toBe(false);
          else for (const o of others) expect(boxDistance(o, [p.x, p.y, p.z]), `D${D} ${p.key}`).toBeGreaterThanOrEqual(BALL_PILLOW / 2);
        }
      }
    }
  });

  it('shallow seats get fewer, never more: 36″ deep keeps the corner taupe square at each arm end', () => {
    const a = pillowAnchors(buildHaven(standardU({ D: 36 })));
    expect(a.length).toBeLessThan(12);
    expect(a.filter((p) => p.key.endsWith(':sq1') && !p.key.startsWith('wedge'))).toHaveLength(2);
    expect(pillowAnchors(buildHaven(standardU({ D: 48 })))).toHaveLength(12);
  });

  it('the same arrangement after the layout travels through a share link', () => {
    for (const c of [standardU(), standardL('right'), standardU({ D: 36 })]) {
      const d = decode(encode(c));
      if (!('config' in d)) throw new Error('link did not decode');
      const strip = (b: ReturnType<typeof buildHaven>) => pillowAnchors(b).map(({ key: _k, ...box }) => box);
      expect(strip(buildHaven(d.config))).toEqual(strip(buildHaven(c)));
    }
  });
});

describe('look data (H5): every fabric and finish round-trips through the link', () => {
  it('FABRICS and FINISHES keys all have link codes', () => {
    for (const f of FABRICS) expect(FABRIC_CODES).toContain(f.key);
    for (const f of FINISHES) expect(FINISH_CODES).toContain(f.key);
  });

  it('setFabric / setTableFinish, then encode/decode', () => {
    for (const f of FABRICS) {
      for (const w of FINISHES) {
        const c = setTableFinish(setFabric(standardU(), f.key).config, w.key).config;
        const d = decode(encode(c));
        expect('config' in d && [d.config.fabric, d.config.tableFinish]).toEqual([f.key, w.key]);
      }
    }
    expect(setFabric(standardU(), 'mystery').rejected?.code).toBe('notAllowed');
  });
});
