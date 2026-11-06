import { describe, expect, it } from 'vitest';
import { checksum, decode, encode, LINK_VERSION } from './codec';
import { decodeLayout, encodeLayout } from './codecLayout';
import { decodeFree, decodeProject, encodeFree } from './codecFree';
import { standardU } from './defaults';
import { toFree } from './freeConvert';
import { doubleSided, facing, freeL, straight } from './freeTesting';
import type { FreeLayout } from './freeTypes';
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

  it('v3 is still read (the current version is 4, freeform pieces)', () => expect(LINK_VERSION).toBe(4));

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

// v4: freeform pieces (stage 3, 2026-11-06). NEVER edit these strings either.
const GOLDEN_V4 = {
  U: '4fD44_wx0y0r0_t32p1a_s36p2e_wp3e_a72Ep4a_a72Sp1b.mg',
  straight: '4fD44_a50Sx0y0r0_s36p1e_a50Ep2e.8w',
  L: '4fD44_wx0y0r0_s36p1a_a50Ep2e_a72Sp1b.jv',
  doubleShared: '4fD44_a50Sx0y0r0_s36p1e_a50Ep2e_a50Sp3kH_s36p4e_a50Ep5e.j4',
  facing: '4fD44_a50Sx0y0r0_s36p1e_a50Ep2e_a50Sx136y148r2_s36p4e_a50Ep5e_cx44y50w48d48.zh',
  Tshared: '4fD44_a59.5Sx0y0r0_wp1e_a50Ep2a_a50Sp3kH_wp4e_a59.5Ep5a.sc',
} as const;

/** A free layout with ids as the decoder writes them (p1… in order), for comparison. */
function renumber(f: FreeLayout): FreeLayout {
  const ids = new Map([...f.pieces, ...f.loose].map((p, i) => [p.id, `p${i + 1}`]));
  return {
    ...f,
    pieces: f.pieces.map((p) => ({ ...p, id: ids.get(p.id)!, at: 'to' in p.at ? { ...p.at, to: ids.get(p.at.to)! } : p.at })),
    loose: f.loose.map((l) => ({ ...l, id: ids.get(l.id)! })),
    nextId: ids.size + 1,
  };
}

describe('golden links v4 (freeform pieces)', () => {
  const layouts: Record<keyof typeof GOLDEN_V4, FreeLayout> = {
    U: toFree(solo(standardU())).free!,
    straight: straight(1),
    L: freeL(),
    doubleShared: doubleSided(true),
    facing: facing(),
    Tshared: toFree(teeLayout({ total: 229, stem: 110 })).free!,
  };

  it('the current encoder still produces them, and they decode back to the same pieces', () => {
    for (const [name, f] of Object.entries(layouts)) {
      const link = GOLDEN_V4[name as keyof typeof GOLDEN_V4];
      expect(encodeFree(f), name).toBe(link);
      const d = decodeFree(link);
      expect('free' in d && d.free, name).toEqual(renumber(f));
      expect(decodeProject(link), name).toEqual(d);
    }
  });

  it('older decoders read v4 as "newer", never "damaged"; v1–v3 links still go through decodeProject', () => {
    expect(decode(GOLDEN_V4.U)).toEqual({ error: 'newer' });
    expect(decodeLayout(GOLDEN_V4.U)).toEqual({ error: 'newer' });
    expect(decodeProject(GOLDEN_V1.T1!)).toEqual(decodeLayout(GOLDEN_V1.T1!));
    expect(decodeProject(GOLDEN_V3.Tshared!)).toEqual(decodeLayout(GOLDEN_V3.Tshared!));
    expect(decodeFree(`5${GOLDEN_V4.U.slice(1)}`)).toEqual({ error: 'newer' });
  });

  it('damaged v4 links', () => {
    const resum = (body: string) => `${body}.${checksum(body)}`;
    const body = (link: string) => link.slice(0, link.lastIndexOf('.'));
    const s = body(GOLDEN_V4.straight);
    const bad = [
      s.replace('4f', '4U'), // a one-sofa header
      s.replace('D44', 'W188D44'), // outside sizes
      s.replace('D44', 'D44K'), // a lock
      s.replace('_a50Sx0y0r0', '_a50x0y0r0'), // a one-arm seat without its arm side
      s.replace('_s36p1e', '_s36Sp1e'), // an arm on an armless seat
      s.replace('_s36p1e', '_wp1e'), // the middle seat a wedge: the next piece's "e" face doesn't exist on it
      s.replace('p2e', 'p3e'), // attached to a later piece
      s.replace('_a50Ep2e', '_a50Ep2eo4'), // an offset on an end face
      s.replace('_s36p1e', '_s36p1s'), // onto the arm (p1's start)
      s.replace('_s36p1e', '_s36x10y10r0'), // overlapping
      s.replace('r0', 'r4'), // a turn that isn't a quarter
    ];
    for (const b of bad) expect(decodeFree(resum(b)), b).toEqual({ error: 'damaged' });
    expect(decodeFree(GOLDEN_V4.straight.slice(0, -3))).toEqual({ error: 'damaged' });
    expect(decodeFree(GOLDEN_V4.straight.replace('.8w', '.zz'))).toEqual({ error: 'damaged' });
    // One piece on its own is fine.
    expect(decodeFree(resum(s.replace('_s36p1e_a50Ep2e', '')))).toMatchObject({ free: { pieces: [{ kind: 'oneArm' }] } });
  });
});
