import { describe, expect, it } from 'vitest';
import { checksum, decode, encode, LINK_VERSION } from './codec';
import { decodeLayout, encodeLayout } from './codecLayout';
import { solo } from './layoutOps';
import { teeLayout } from './tee';
import type { Config } from './types';
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

// v2 (2026-09-26) adds Y = table style. Layouts v1 can express keep their v1
// links (above); only a non-standard table style needs v2. NEVER edit these.
const GOLDEN_V2: Record<string, string> = {
  T1allWood: '2UW188L132R132D44Y1_bt32s36_la72_ra72.9m',
  kitchenSinkAllWood: '2UW300.5L132R132D40C60KS26N22Xc7T1Y1_bt32s74.5~s74_la72_ra72_cx126.5y62w48d48_ox-10.5y150w30d20.5i',
};

describe('golden links v2', () => {
  const configs: Record<string, Config> = {
    T1allWood: { ...fixtures().T1!, tableStyle: 'allWood' },
    kitchenSinkAllWood: { ...kitchenSink(), tableStyle: 'allWood' },
  };

  it('every golden link still decodes to its fixture', () => {
    for (const [name, link] of Object.entries(GOLDEN_V2)) {
      const d = decode(link);
      expect(d, name).toHaveProperty('config');
      if ('config' in d) expect(canon(d.config), name).toEqual(canon(configs[name]!));
    }
  });

  it('the current encoder still produces them', () => {
    for (const [name, c] of Object.entries(configs)) expect(encode(c), name).toBe(GOLDEN_V2[name]);
  });

  it('v1 links decode to the standard table style; a v1 link may not carry Y', () => {
    const d = decode(GOLDEN_V1.T1!);
    expect('config' in d && d.config.tableStyle).toBe('standard');
    // A valid checksum, so the version gate itself is what refuses it.
    const body = '1UW188L132R132D44Y1_bt32s36_la72_ra72';
    expect(decode(`${body}.${checksum(body)}`)).toEqual({ error: 'damaged' });
  });
});

// v3 (2026-10-26, shapes) adds joined sections (`_P`), the T sectional first.
// A one-section layout still writes its exact v1/v2 link. NEVER edit these.
const GOLDEN_V3: Record<string, string> = {
  Tshared: '3rW119.5L110R110D44_ba59.5_ra50_PglW119.5L110R110H_ba59.5_la50.7o',
  Ttwo: '3rW114.5L110R110D44_ba54.5_ra50_PglW114.5L110R110_ba54.5_la50.y2',
};

describe('golden links v3', () => {
  const layouts = {
    Tshared: teeLayout({ total: 229, stem: 110, D: 44, sharedBack: true }),
    Ttwo: teeLayout({ total: 229, stem: 110, D: 44, sharedBack: false }),
  };

  it('is the current version', () => expect(LINK_VERSION).toBe(3));

  it('the current encoder still produces them, and they decode back to the same layout', () => {
    for (const [name, l] of Object.entries(layouts)) {
      expect(encodeLayout(l), name).toBe(GOLDEN_V3[name]);
      const d = decodeLayout(GOLDEN_V3[name]!);
      expect(d, name).toHaveProperty('layout');
      if ('layout' in d) expect(d.layout.sections.map((s) => canon(s.config)), name).toEqual(l.sections.map((s) => canon(s.config)));
    }
  });

  it('every v1 and v2 golden is still written byte for byte as a one-section layout', () => {
    const all: Record<string, Config> = {
      ...fixtures(),
      kitchenSink: kitchenSink(),
      T1allWood: { ...fixtures().T1!, tableStyle: 'allWood' },
      kitchenSinkAllWood: { ...kitchenSink(), tableStyle: 'allWood' },
    };
    const golden = { ...GOLDEN_V1, ...GOLDEN_V2 };
    for (const [name, link] of Object.entries(golden)) {
      expect(encodeLayout(solo(all[name]!)), name).toBe(link);
      const d = decodeLayout(link);
      expect('layout' in d && d.layout.sections.length, name).toBe(1);
      if ('layout' in d) expect(canon(d.layout.sections[0]!.config), name).toEqual(canon(all[name]!));
    }
  });
});
