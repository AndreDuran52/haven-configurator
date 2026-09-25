import { describe, expect, it } from 'vitest';
import { fmtFtIn, fmtIn, parseInches } from './format';

describe('format', () => {
  it('labels inches with ½ and feet-inches for overalls', () => {
    expect(fmtIn(60)).toBe('60"');
    expect(fmtIn(74.5)).toBe('74½"');
    expect(fmtIn(0.5)).toBe('½"');
    expect(fmtFtIn(188)).toBe(`15'-8"`);
  });

  it('parses the MeasureField formats (plan §8)', () => {
    const cases: [string, number][] = [
      ['188', 188],
      ['188.5', 188.5],
      ['188 1/2', 188.5],
      ['188½', 188.5],
      ['188"', 188],
      [`15'8"`, 188],
      [`15' 8 1/2"`, 188.5],
      [`15'-8"`, 188],
      [`15'`, 180],
      ['  44 ', 44],
      ['1/2', 0.5],
    ];
    for (const [s, v] of cases) expect(parseInches(s), s).toBe(v);
    for (const s of ['', 'abc', '15x', '1/0', "15'x", '-3']) expect(parseInches(s), s).toBeNull();
  });
});
