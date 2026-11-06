// Shapes milestone, Stage A (Andre, 2026-10-26): layouts of joined sections,
// the T sectional, both stem back options, solo identity.
import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { encode } from './codec';
import { decodeLayout, encodeLayout } from './codecLayout';
import { standardL, standardU } from './defaults';
import { buildLayout, layoutErrors } from './layoutBuild';
import { editSection, layoutWedgeRange, replaceSection, setLayoutWedge, solo } from './layoutOps';
import { setArmWidth, setFabric, setMeasurements, setWedge } from './ops';
import { setShape } from './shape';
import { setTeeSharedBack, setTeeStem, setTeeWidth, teeHalves, teeLayout, teeOf } from './tee';
import { deepFreeze, desc, fixtures, kitchenSink, valid } from './testing';

const client = (sharedBack: boolean) => deepFreeze(teeLayout({ total: 229, stem: 110, D: 44, sharedBack }));

describe('a one-section layout is exactly today’s sofa', () => {
  it('same link, same build, same bounds and seats, for every fixture', () => {
    for (const [name, c] of Object.entries({ ...fixtures(), kitchenSink: kitchenSink() })) {
      const l = solo(c);
      expect(encodeLayout(l), name).toBe(encode(c));
      const built = buildHaven(c);
      const lb = buildLayout(l, () => built);
      expect(lb.sections[0]!.built).toBe(built);
      expect(lb.bounds).toBe(built.bounds);
      expect(lb.seats).toBe(built.seats);
      expect(lb.warnings.map((w) => w.message)).toEqual(built.warnings.map((w) => w.message));
      expect(lb.errors).toEqual(built.errors);
      const d = decodeLayout(encode(c));
      expect('layout' in d && d.layout.sections.length, name).toBe(1);
    }
  });
});

describe('the T (client: 229 across, 110 stem, 44 deep)', () => {
  it('shared back: halves 119.5, wings one-arm 59.5 (45.5 + 14), legs one-arm 50 (36 + 14), stem 78, Seats 6', () => {
    const l = client(true);
    const [a, b] = l.sections.map((s) => s.config);
    valid(a!);
    valid(b!);
    expect([a!.W, b!.W]).toEqual([119.5, 119.5]);
    expect(desc(a!, 'back')).toEqual(['oneArm 59.5=45.5+14@start']);
    expect(desc(a!, 'right')).toEqual(['oneArm 50=36+14@end']);
    expect(desc(b!, 'back')).toEqual(['oneArm 59.5=45.5+14@end']);
    expect(desc(b!, 'left')).toEqual(['oneArm 50=36+14@end']);
    const lb = buildLayout(l);
    expect(lb.errors).toEqual([]);
    expect(lb.sections.map((s) => s.offset)).toEqual([
      [0, 0],
      [109.5, 0],
    ]);
    expect(lb.joints[0]!.strip).toEqual({ x: 109.5, y: 0, w: 10, h: 110 });
    expect(lb.joints[0]!.stem).toEqual({ parent: 110, child: 110, width: 78 });
    expect(lb.overall).toEqual({ W: 229, depth: 110 });
    expect(lb.seats.label).toBe('Seats 6');
    expect(teeOf(l)).toMatchObject({ total: 229, stem: [110, 110], stemWidth: 78, sharedBack: true });
  });

  it('two backs: halves 114.5, wings one-arm 54.5 (40.5 + 14), stem 88, Seats 6', () => {
    const l = client(false);
    const [a, b] = l.sections.map((s) => s.config);
    expect([a!.W, b!.W]).toEqual([114.5, 114.5]);
    expect(desc(a!, 'back')).toEqual(['oneArm 54.5=40.5+14@start']);
    const lb = buildLayout(l);
    expect(lb.sections[1]!.offset).toEqual([114.5, 0]);
    expect(lb.joints[0]!.strip).toBeNull();
    expect(lb.joints[0]!.stem.width).toBe(88);
    expect(lb.overall).toEqual({ W: 229, depth: 110 });
    expect(lb.seats.label).toBe('Seats 6');
  });

  it('halves split on the half inch, the left half takes the extra 0.5', () => {
    expect(teeHalves(229.5, true)).toEqual([120, 119.5]);
    expect(teeHalves(240, true)).toEqual([125, 125]);
    expect(teeHalves(229, false)).toEqual([114.5, 114.5]);
    expect(teeHalves(229.5, false)).toEqual([115, 114.5]);
  });

  it('total width, stem and back option keep the T whole', () => {
    const l = client(true);
    const w = setTeeWidth(l, 240);
    expect(w.rejected).toBeNull();
    expect(teeOf(w.layout)).toMatchObject({ total: 240 });
    expect(w.layout.sections.map((s) => s.config.W)).toEqual([125, 125]);
    const s = setTeeStem(l, 120);
    expect(desc(s.layout.sections[0]!.config, 'right')).toEqual(['oneArm 60=46+14@end']);
    expect(teeOf(s.layout)!.stem).toEqual([120, 120]);
    const two = setTeeSharedBack(l, false);
    expect(teeOf(two.layout)).toMatchObject({ total: 229, sharedBack: false, stemWidth: 88 });
    expect(two.layout.sections.map((x) => x.config.W)).toEqual([114.5, 114.5]);
    const back = setTeeSharedBack(two.layout, true);
    expect(encodeLayout(back.layout)).toBe(encodeLayout(l));
    const tiny = setTeeWidth(l, 100);
    expect(tiny.layout).toBe(l);
    expect(tiny.rejected?.message).toMatch(/^min \d/);
  });

  it('an edit on one half keeps the other attached; shared fields follow; same reference when refused', () => {
    const l = client(true);
    const r = editSection(l, 'a', (c) => setMeasurements(c, { W: 125.5 }));
    expect(r.rejected).toBeNull();
    expect(r.layout.sections[1]).toBe(l.sections[1]); // untouched half keeps its object
    expect(buildLayout(r.layout).sections[1]!.offset).toEqual([115.5, 0]);
    // Depth from the right half reaches the left half.
    const d = editSection(l, 'b', (c) => setMeasurements(c, { D: 40 }));
    expect(d.layout.sections.map((s) => [s.config.D, s.config.W])).toEqual([
      [40, 119.5],
      [40, 119.5],
    ]);
    expect(desc(d.layout.sections[0]!.config, 'back')).toEqual(['oneArm 63.5=49.5+14@start']);
    expect(buildLayout(d.layout).joints[0]!.stem.width).toBe(70);
    // Look and arm width.
    const a = editSection(l, 'a', (c) => setArmWidth(c, 10));
    expect(a.layout.sections.map((s) => s.config.dims.A)).toEqual([10, 10]);
    const f = editSection(l, 'b', (c) => setFabric(c, c.fabric));
    expect(f.layout).toBe(l);
    // The left half cannot lose its right leg (the stem).
    const bad = editSection(l, 'a', (c) => setShape(c, 'L-left'));
    expect(bad.layout).toBe(l);
    expect(bad.rejected?.message).toMatch(/right leg/);
    // A refused engine op is passed through with the same reference.
    const no = editSection(l, 'a', (c) => setMeasurements(c, { W: 50 }));
    expect(no.layout).toBe(l);
    expect(no.rejected).not.toBeNull();
    expect(replaceSection(l, 'a', l.sections[0]!.config).layout).toBe(l);
  });

  it('one corner size for the whole T, within what both halves can take', () => {
    const l = client(true);
    const range = layoutWedgeRange(l);
    expect(range.min).toBe(44);
    const r = setLayoutWedge(l, 55);
    expect(r.rejected).toBeNull();
    expect(r.layout.sections.map((s) => s.config.wedgeC)).toEqual([55, 55]);
    expect(desc(r.layout.sections[1]!.config, 'left')).toEqual(['oneArm 55=41+14@end']);
    const direct = editSection(l, 'a', (c) => setWedge(c, 52));
    expect(direct.layout.sections.map((s) => s.config.wedgeC)).toEqual([52, 52]);
  });

  it('structural errors: unjoined, missing legs, different shared fields, loose pieces outside the root', () => {
    const l = client(true);
    const U = standardU();
    expect(layoutErrors({ schema: 1, sections: [l.sections[0]!, { ...l.sections[1]!, join: null }] })[0]).toMatch(/not joined/);
    expect(layoutErrors({ schema: 1, sections: [{ id: 'a', config: standardL('left'), join: null }, l.sections[1]!] })[0]).toMatch(/no right leg/);
    expect(layoutErrors({ schema: 1, sections: [l.sections[0]!, { ...l.sections[1]!, config: { ...l.sections[1]!.config, D: 40 } }] })[0]).toMatch(/differs.*D/);
    expect(layoutErrors({ schema: 1, sections: [l.sections[0]!, { ...l.sections[1]!, config: { ...l.sections[1]!.config, loose: U.loose.concat([{ id: 'x', kind: 'ottoman', x: 0, y: 0, w: 30, d: 20 }]) } }] })[0]).toMatch(/loose/);
  });
});

describe('link v3', () => {
  const GOLDEN_V3 = {
    Tshared: encodeLayout(client(true)),
    Ttwo: encodeLayout(client(false)),
  };

  it('a T writes v3: the root exactly as v1/v2, then the joined half', () => {
    expect(GOLDEN_V3.Tshared).toMatch(/^3rW119\.5L110R110D44_ba59\.5_ra50_PglW119\.5L110R110H_ba59\.5_la50\.[0-9a-z]{2}$/);
    expect(GOLDEN_V3.Ttwo).toMatch(/^3rW114\.5L110R110D44_ba54\.5_ra50_PglW114\.5L110R110_ba54\.5_la50\.[0-9a-z]{2}$/);
  });

  it('round trips (layout, offsets, every piece)', () => {
    for (const sharedBack of [true, false]) {
      const l = client(sharedBack);
      const d = decodeLayout(encodeLayout(l));
      expect('layout' in d).toBe(true);
      if (!('layout' in d)) continue;
      expect(d.layout.sections.map((s) => [s.id, s.join, s.config.shape, s.config.W])).toEqual(l.sections.map((s) => [s.id, s.join, s.config.shape, s.config.W]));
      expect(encodeLayout(d.layout)).toBe(encodeLayout(l));
      expect(buildLayout(d.layout).sections.map((s) => s.offset)).toEqual(buildLayout(l).sections.map((s) => s.offset));
      // Ids stay unique within each half (pieces are addressed as section:id).
      const ids = d.layout.sections.flatMap((s) => Object.values(s.config.runs).flatMap((ps) => ps!.map((p) => `${s.id}:${p.id}`)));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  const resum = (body: string) => {
    let h = 2166136261;
    for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 16777619);
    return `${body}.${((h >>> 0) % 1296).toString(36).padStart(2, '0')}`;
  };
  const bodyOf = (link: string) => link.slice(0, link.lastIndexOf('.'));

  it('damaged: a _P token in an older link, shared fields or loose pieces in a joined half, missing sizes, wrong legs', () => {
    const t = bodyOf(GOLDEN_V3.Tshared);
    const bad = [
      `1${t.slice(1)}`, // v1 cannot carry sections
      t.replace('_PglW119.5', '_PglW119.5D40'),
      t.replace('R110H', 'R110HK'),
      t.replace('L110R110H_', 'L110H_'),
      t.replace('_Pgl', '_Pxl'),
      t.replace('_Pgl', '_Pgr'), // the right half must have a left leg
      `${t}_ox10y10w30d20`, // loose pieces only in the root block
      t.replace('_la50', '_la50_la50'),
      t.replace('_la50', '_ra50'),
      t.replace('_ra50_P', '_la50_P'),
    ];
    for (const b of bad) expect(decodeLayout(resum(b)), b).toEqual({ error: 'damaged' });
    expect(decodeLayout(GOLDEN_V3.Tshared.slice(0, -4))).toEqual({ error: 'damaged' });
    expect(decodeLayout(`4${GOLDEN_V3.Tshared.slice(1)}`)).toEqual({ error: 'newer' });
  });

  it('the one-sofa decoder calls a T "newer" and still reads a v3 link with no sections', async () => {
    const { decode } = await import('./codec');
    expect(decode(GOLDEN_V3.Tshared)).toEqual({ error: 'newer' });
    const u = bodyOf(encode(standardU())).replace(/^1/, '3');
    expect('config' in decode(resum(u))).toBe(true);
  });
});
