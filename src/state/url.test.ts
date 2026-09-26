import { describe, expect, it } from 'vitest';
import { encode, setMeasurements, standardU } from '@/engine';
import { DAMAGED_MESSAGE, NEWER_MESSAGE, codeFromHash, initialConfig, isViewMode, urlFor } from './url';

describe('URL hash (plan §8)', () => {
  it('writes #c=<code> after path + search, so ?view survives a commit', () => {
    const c = setMeasurements(standardU(), { D: 36 }).config;
    expect(urlFor({ pathname: '/', search: '?view' }, c)).toBe(`/?view#c=${encode(c)}`);
    expect(isViewMode('?view')).toBe(true);
    expect(isViewMode('')).toBe(false);
  });

  it('loads the hash, else the Standard U; a damaged or newer link says so', () => {
    const c = setMeasurements(standardU(), { W: 300 }).config;
    const loaded = initialConfig(`#c=${encode(c)}`);
    expect(loaded.message).toBeNull();
    expect(encode(loaded.config)).toBe(encode(c)); // ids are regenerated on decode
    expect(initialConfig('').config).toEqual(standardU());
    expect(initialConfig('#c=1UW188.zz').message).toBe(DAMAGED_MESSAGE);
    expect(initialConfig(`#c=9${encode(c).slice(1)}`).message).toBe(NEWER_MESSAGE);
    expect(codeFromHash('#other')).toBeNull();
  });
});
