import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { decode, encode } from './codec';
import { standardL } from './defaults';
import { setArmWidth, setLock } from './ops';
import { cushionOf } from './pieces';
import { deepFreeze, desc, U, valid } from './testing';
import type { Config } from './types';

const cushions = (c: Config) =>
  Object.values(c.runs)
    .flat()
    .filter((p) => p!.kind === 'oneArm')
    .map((p) => cushionOf(p!, c.dims.A));

describe('arm width (Andre, 2026-09-28): 6–14″, every seat cushion keeps its size', () => {
  it('lock on: a leg that is one piece keeps its footprint (its cushion takes the change); otherwise the neighbour absorbs', () => {
    const c0 = deepFreeze(U());
    const r = setArmWidth(c0, 10);
    expect(r.rejected).toBeNull();
    const c = r.config;
    valid(c);
    expect(c.dims.A).toBe(10);
    // Standard U legs are a single one-arm 72: no gap, the cushion grows 58 → 62.
    expect(desc(c, 'left')).toEqual(['oneArm 72=62+10@end']);
    expect([c.W, c.L, c.R]).toEqual([c0.W, c0.L, c0.R]);
    // A leg with two seats: the one-arm keeps its 22″ cushion, the armless next to it absorbs.
    const two = { ...U(), runs: { ...U().runs, left: [{ id: 'x1', kind: 'armless' as const, length: 36 }, { ...U().runs.left![0]!, length: 36 }] } };
    const t = setArmWidth(two, 10).config;
    valid(t);
    expect(desc(t, 'left')).toEqual(['armless 40', 'oneArm 32=22+10@end']);
  });

  it('lock off: the runs change instead, the cushions stay', () => {
    const c0 = setLock(U(), false).config;
    const c = setArmWidth(c0, 12).config;
    valid(c);
    expect(cushions(c)).toEqual([58, 58]);
    expect([c.L, c.R]).toEqual([c0.L - 2, c0.R - 2]);
    const wider = setArmWidth(setArmWidth(c0, 8).config, 14).config;
    expect([wider.L, wider.R]).toEqual([c0.L, c0.R]);
  });

  it('refuses outside 6–14, keeps the same reference on no change, snaps to the half inch', () => {
    const c = U();
    for (const bad of [5.5, 14.5, NaN]) {
      const r = setArmWidth(c, bad);
      expect(r.rejected?.code).toBe('infeasible');
      expect(r.config).toBe(c);
    }
    expect(setArmWidth(c, 14)).toEqual({ config: c, rejected: null });
    expect(setArmWidth(c, 9.3).config.dims.A).toBe(9.5);
  });

  it('works on the L shapes and travels through a share link', () => {
    for (const side of ['left', 'right'] as const) {
      const c = setArmWidth(standardL(side), 8).config;
      valid(c);
      const d = decode(encode(c));
      expect('config' in d && d.config.dims.A).toBe(8);
    }
  });

  it('a link with an arm width outside 6–14 is damaged', () => {
    const link = encode(setArmWidth(U(), 10).config).replace('XA10', 'XA30');
    expect(link).toContain('XA30');
    expect(decode(link)).toEqual({ error: 'damaged' });
  });
});

describe('seat warning at 23″ (Andre, 2026-09-28)', () => {
  const warnsAt = (cushion: number) => {
    // A one-arm leg of `cushion` + 14: shrink the Standard U's left leg by typing L.
    const c = U();
    const dL = 58 - cushion;
    const b = buildHaven({ ...c, L: c.L - dL, runs: { ...c.runs, left: [{ ...c.runs.left![0]!, length: 72 - dL }] } });
    return b.warnings.filter((w) => w.code === 'seatNarrow').map((w) => w.message);
  };

  it('22″ warns "(under 23)", 23″ does not', () => {
    expect(warnsAt(22)).toEqual(['Seat 22″ (under 23)']);
    expect(warnsAt(23)).toEqual([]);
  });
});
