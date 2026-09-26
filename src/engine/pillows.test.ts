import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { decode, encode, FABRIC_CODES, FINISH_CODES } from './codec';
import { standardL, standardU } from './defaults';
import { FABRICS, FINISHES } from './fabrics';
import { pillowAnchors, pillowCorners, SQUARE_PILLOW } from './pillows';
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

describe('pillows (Q15, Andre 2026-09-26: like the showroom photo)', () => {
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

  it('every pillow sits over the sofa (footprint) and never inside an arm; squares sit on the seat', () => {
    for (const c of [standardU(), standardL('left'), standardU({ W: 300, D: 36 })]) {
      const b = buildHaven(c);
      const polys = b.pieces.filter((p) => p.run || p.corner).map((p) => p.polygon);
      const arms = b.pieces.flatMap((p) => (p.arm ? [p.arm.rect] : []));
      for (const p of pillowAnchors(b)) {
        const corners = pillowCorners(p);
        for (const [x, y] of corners) {
          expect(polys.some((poly) => inPoly([x, y], poly)), `${p.key} (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
          expect(arms.some((r) => x > r.x + 0.01 && x < r.x + r.w - 0.01 && y > r.y + 0.01 && y < r.y + r.h - 0.01), `${p.key} in an arm`).toBe(false);
        }
        const bottom = Math.min(...corners.map((q) => q[2]));
        if (p.kind === 'square') expect(bottom).toBeGreaterThan(b.heights.deckHeight + b.heights.cushionEdge - SQUARE_PILLOW.t);
      }
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
