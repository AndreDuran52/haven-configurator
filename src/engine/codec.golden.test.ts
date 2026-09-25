import { describe, expect, it } from 'vitest';
import { decode, encode, LINK_VERSION } from './codec';
import { canon, fixtures, kitchenSink } from './testing';

// Golden share links, frozen at the end of H1. Links are forever (CLAUDE.md
// rule 6): NEVER edit these strings. A format change bumps LINK_VERSION, adds a
// decoder/migration, and adds a new golden block alongside this one.
const GOLDEN_V1: Record<string, string> = {
  T1: '1UW188L132R132D44_bt32s36_la72_ra72.wh',
  T2: '1UW188L132R132D36_bt32s52_la80_ra80.pg',
  T3a: '1UW188L132R132D44_bs68_ls40t32_ra72.j9',
  T3b: '1UW188L132R132D44_bs68_ls13jt32a27j_ra72.wr',
  T4: '1rW120L132R100D44_ba60_ra40.wv',
  T5: '1UW300L132R132D44_bt32s74~s74_la72_ra72.fh',
  T6: '1UW188L132R132D44C55_bt32s46_la77_ra77.kl',
  T7: '1UW188L132R132D44_bt32s36_la72_rs72.lb',
  T8: '1UW188L132R132D44_bg68_lg72_rg72.ct',
  kitchenSink: '1UW300.5L132R132D40C60KS26N22Xc7T1_bt32s74.5~s74_la72_ra72_cx126.5y62w48d48_ox-10.5y150w30d20.89',
};

describe('golden links v1', () => {
  const configs = { ...fixtures(), kitchenSink: kitchenSink() };

  it('every golden link still decodes to its fixture', () => {
    expect(LINK_VERSION).toBe(1);
    for (const [name, link] of Object.entries(GOLDEN_V1)) {
      const d = decode(link);
      expect(d, name).toHaveProperty('config');
      if ('config' in d) expect(canon(d.config), name).toEqual(canon(configs[name as keyof typeof configs]));
    }
  });

  it('the current encoder still produces them (v1 output is stable)', () => {
    for (const [name, c] of Object.entries(configs)) expect(encode(c), name).toBe(GOLDEN_V1[name]);
  });
});
