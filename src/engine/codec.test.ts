import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { blankConfig, standardL, standardU } from './defaults';
import { decode, encode } from './codec';
import { runIds } from './layout';
import { canon, fixtures, idAt, op, raw, shapeOf, tableId, test3b, U, valid } from './testing';
import type { Config } from './types';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomConfig(seed: number): Config {
  const r = mulberry32(seed);
  const starts = [standardU(), standardL('left'), standardL('right', { W: 150, R: 110 }), blankConfig('U'), standardU({ W: 300 })];
  let c = starts[Math.floor(r() * starts.length)]!;
  for (let i = 0; i < 12; i++) {
    const all = runIds(c.shape).flatMap((run) => c.runs[run]!.map((p) => ({ run, p })));
    const pick = all[Math.floor(r() * all.length)];
    const k = Math.floor(r() * 10);
    let next = c;
    if (k === 0) next = raw.setWedge(c, 44 + Math.floor(r() * 30)).config;
    else if (k === 1 && pick) next = raw.dragSeam(c, pick.run, 1, Math.round((r() - 0.5) * 30) / 2).config;
    else if (k === 2) next = raw.setMeasurements(c, { W: 160 + Math.floor(r() * 180) + (r() > 0.5 ? 0.5 : 0) }).config;
    else if (k === 3 && pick) next = raw.addPiece(c, 'table', { run: pick.run, at: 'seam', seam: 0 }).config;
    else if (k === 4) next = raw.setLock(c, r() > 0.5).config;
    else if (k === 5) next = raw.addLoose(c, r() > 0.5 ? 'ottoman' : 'coffeeTable').config;
    else if (k === 6 && pick && pick.p.kind !== 'gap') next = raw.deletePiece(c, pick.p.id).config;
    else if (k === 7 && pick && pick.p.kind !== 'gap' && pick.p.kind !== 'table') {
      const t = c.runs.back!.find((p) => p.kind === 'table') ?? c.runs[pick.run]!.find((p) => p.kind === 'table');
      if (t) next = raw.moveTable(c, t.id, { run: pick.run, at: 'split', pieceId: pick.p.id }).config;
    } else if (k === 8) next = { ...c, snugWidth: 22 + Math.floor(r() * 4), tableFinish: r() > 0.5 ? 'darkWood' : 'walnut' };
    else if (k === 9) next = { ...c, dims: { ...c.dims, cushionCrown: 7 + Math.floor(r() * 3), ottomanHeight: 17 } };
    c = next;
  }
  return c;
}

describe('share link v1', () => {
  it('Standard U is short and exact (38 characters)', () => {
    const link = encode(standardU());
    expect(link).toBe('1UW188L132R132D44_bt32s36_la72_ra72.wh');
    expect(link).toMatch(/^[A-Za-z0-9._~-]+[a-z0-9]$/);
    const d = decode(link);
    expect('config' in d && canon(d.config)).toEqual(canon(standardU()));
  });

  it('E16 codec_roundTrip: the 9 fixtures and 400 random sequences round-trip (incl. joinedBy, snug, dims, finish, bboxes)', () => {
    const cases = [...Object.values(fixtures())];
    for (let i = 0; i < 400; i++) cases.push(randomConfig(i + 1));
    let maxLen = 0;
    let joined = 0;
    for (const c of cases) {
      const link = encode(c);
      maxLen = Math.max(maxLen, link.length);
      if (c.runs.left?.some((p) => p.joinedBy) || c.runs.back?.some((p) => p.joinedBy)) joined++;
      const d = decode(link);
      expect(d).toHaveProperty('config');
      if (!('config' in d)) continue;
      expect(canon(d.config)).toEqual(canon(c));
      const a = buildHaven(c);
      const b = valid(d.config);
      expect(b.pieces.map((p) => [p.kind, p.bbox])).toEqual(a.pieces.map((p) => [p.kind, p.bbox]));
    }
    expect(joined).toBeGreaterThan(10); // the j marker was exercised
    expect(maxLen).toBeLessThan(200);
  });

  it('E6b tableRoundTrip_afterCodec: 3b, encode/decode, then back to back seam 0 equals the Standard U', () => {
    const d = decode(encode(test3b()));
    if (!('config' in d)) throw new Error('decode failed');
    const c = d.config;
    expect(c.runs.left!.map((p) => !!p.joinedBy)).toEqual([true, false, true]);
    const back = op.moveTable(c, tableId(c), { run: 'back', at: 'seam', seam: 0 });
    expect(shapeOf(back)).toEqual(shapeOf(U()));
    expect(idAt(back, 'left', 0)).toBe(idAt(c, 'left', 0));
  });

  it('detects damage, truncation, invalid geometry and newer versions', () => {
    const link = encode(fixtures().T3b!);
    expect(decode(link.slice(0, -5))).toEqual({ error: 'damaged' }); // truncated by a mail client
    expect(decode(link.replace('t32', 't38'))).toEqual({ error: 'damaged' }); // edited by hand
    expect(decode(`9${link.slice(1)}`)).toEqual({ error: 'newer' });
    expect(decode('hello')).toEqual({ error: 'damaged' });
    // a checksum-valid link whose runs don't add up is still damaged
    const body = '1UW188L132R132D44_bt32s30_la72_ra72';
    let h = 2166136261;
    for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 16777619);
    expect(decode(`${body}.${((h >>> 0) % 1296).toString(36).padStart(2, '0')}`)).toEqual({ error: 'damaged' });
  });

  it('carries geometry, fabric and finish only (no names or prices exist in the config)', () => {
    const c = { ...U(), tableFinish: 'darkWood' as const };
    expect(encode(c)).toMatch(/^1UW188L132R132D44T1_bt32s36_la72_ra72\.[0-9a-z]{2}$/);
    expect(() => encode({ ...c, fabric: 'mystery' })).toThrow();
  });
});
