// Shapes milestone: 2,000 random edits on random halves of random T's. The
// shared fields stay equal, the joins stay valid, the halves never overlap
// outside the shared strip, a refusal is the same reference, and every layout
// round trips through its link.
import { describe, expect, it } from 'vitest';
import { decodeLayout, encodeLayout } from './codecLayout';
import { buildLayout, layoutErrors, sharedDiff } from './layoutBuild';
import { editSection, setLayoutWedge, type LayoutResult } from './layoutOps';
import type { Layout } from './layoutTypes';
import { setTeeSharedBack, setTeeStem, setTeeWidth, teeLayout } from './tee';
import { deepFreeze, raw, valid } from './testing';
import { runIds } from './layout';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('layout property', () => {
  it('2,000 random ops on T halves keep the T valid', () => {
    const rnd = mulberry32(2026);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    let changed = 0;
    for (let seq = 0; seq < 100; seq++) {
      let l: Layout = teeLayout({ total: int(200, 320), stem: int(100, 200), D: pick([36, 40, 44]), sharedBack: rnd() < 0.5 });
      for (let step = 0; step < 20; step++) {
        const sec = pick(l.sections);
        const c = sec.config;
        const run = pick(runIds(c.shape));
        const ps = c.runs[run]!;
        const any = ps.length ? pick(ps) : undefined;
        const ops: (() => LayoutResult)[] = [
          () => editSection(l, sec.id, (x) => raw.setMeasurements(x, { W: x.W + int(-30, 30) / 2 })),
          () => editSection(l, sec.id, (x) => raw.setMeasurements(x, { D: pick([36, 40, 44]) })),
          () => editSection(l, sec.id, (x) => raw.setMeasurements(x, { L: x.L + int(-20, 20), R: x.R + int(-20, 20) })),
          () => editSection(l, sec.id, (x) => raw.setWedge(x, int(30, 80))),
          () => editSection(l, sec.id, (x) => raw.setLock(x, rnd() < 0.5)),
          () => editSection(l, sec.id, (x) => raw.setArmWidth(x, int(12, 28) / 2)),
          () => editSection(l, sec.id, (x) => raw.resizePiece(x, any?.id ?? 'x', (any?.length ?? 30) + int(-40, 40) / 2)),
          () => editSection(l, sec.id, (x) => raw.dragSeam(x, run, int(0, ps.length), int(-60, 60) / 2)),
          () => editSection(l, sec.id, (x) => raw.addPiece(x, pick(['armless', 'table'] as const), { run, at: 'seam', seam: int(0, ps.length) })),
          () => editSection(l, sec.id, (x) => raw.deletePiece(x, any?.id ?? 'x')),
          () => editSection(l, sec.id, (x) => raw.setEndCap(x, run, pick(['arm', 'table', 'open'] as const))),
          () => editSection(l, sec.id, (x) => raw.setShape(x, pick(['U', 'L-left', 'L-right'] as const))),
          () => setLayoutWedge(l, int(30, 80)),
          () => setTeeWidth(l, int(180, 340) / 1),
          () => setTeeStem(l, int(90, 220)),
          () => setTeeSharedBack(l, rnd() < 0.5),
        ];
        deepFreeze(l);
        const before = JSON.stringify(l);
        const r = pick(ops)();
        expect(JSON.stringify(l)).toBe(before); // input untouched
        if (r.layout === l) continue;
        expect(r.rejected).toBeNull(); // refused => same reference
        l = r.layout;
        changed++;
        for (const s of l.sections) valid(s.config);
        expect(layoutErrors(l)).toEqual([]);
        expect(sharedDiff(l.sections[0]!.config, l.sections[1]!.config)).toEqual([]);
        const lb = buildLayout(l);
        expect(lb.errors).toEqual([]);
        // No overlap between the halves outside the shared strip.
        const [a, b] = lb.sections;
        const strip = lb.joints[0]!.strip;
        const aMax = Math.max(...a!.built.pieces.flatMap((p) => p.polygon.map((q) => q[0] + a!.offset[0])));
        const bMin = Math.min(...b!.built.pieces.flatMap((p) => p.polygon.map((q) => q[0] + b!.offset[0])));
        expect(bMin).toBeGreaterThanOrEqual(aMax - (strip ? strip.w : 0) - 1e-9);
        const d = decodeLayout(encodeLayout(l));
        expect('layout' in d && encodeLayout(d.layout)).toBe(encodeLayout(l));
      }
    }
    expect(changed).toBeGreaterThan(500);
  });
});
