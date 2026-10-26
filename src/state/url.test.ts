import { describe, expect, it } from 'vitest';
import { encode, encodeLayout, rootConfig, setMeasurements, solo, standardU, teeLayout } from '@/engine';
import { DAMAGED_MESSAGE, NEWER_MESSAGE, codeFromHash, initialLayout, isViewMode, urlFor } from './url';

describe('URL hash (plan §8)', () => {
  it('writes #c=<code> after path + search, so ?view survives a commit', () => {
    const c = setMeasurements(standardU(), { D: 36 }).config;
    expect(urlFor({ pathname: '/', search: '?view' }, solo(c))).toBe(`/?view#c=${encode(c)}`);
    expect(isViewMode('?view')).toBe(true);
    expect(isViewMode('')).toBe(false);
  });

  it('loads the hash, else the Standard U; a damaged or newer link says so', () => {
    const c = setMeasurements(standardU(), { W: 300 }).config;
    const loaded = initialLayout(`#c=${encode(c)}`);
    expect(loaded.message).toBeNull();
    expect(encode(rootConfig(loaded.layout))).toBe(encode(c)); // ids are regenerated on decode
    expect(rootConfig(initialLayout('').layout)).toEqual(standardU());
    expect(initialLayout('#c=1UW188.zz').message).toBe(DAMAGED_MESSAGE);
    expect(initialLayout(`#c=9${encode(c).slice(1)}`).message).toBe(NEWER_MESSAGE);
    expect(codeFromHash('#other')).toBeNull();
  });

  it('Stage A: a T link is a newer layout this build does not open yet (never "damaged")', () => {
    const t = initialLayout(`#c=${encodeLayout(teeLayout({ total: 229, stem: 110 }))}`);
    expect(t.message).toBe(NEWER_MESSAGE);
    expect(t.layout.sections).toHaveLength(1);
  });
});
