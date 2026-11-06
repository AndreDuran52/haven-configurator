// Freeform property test (stage 3): 2,000 seeded random edits on free layouts.
// After every one: the layout lays out (no overlap but frame on frame, every
// attached piece on a real open face, parents before children), poses sit on
// the half-inch grid, a refusal returns the same reference, and the v4 link
// round-trips exactly.
import { describe, expect, it } from 'vitest';
import { decodeFree, encodeFree } from './codecFree';
import { standardU } from './defaults';
import { buildFree } from './freeBuild';
import { toFree } from './freeConvert';
import { addFree, moveFree, removeFree, setFreeArm, setFreeLength, setFreeShared, setFreeSharedBack, turnFree, without } from './freeOps';
import { isRoot } from './freePose';
import { snapTargets } from './freeSnap';
import { straight } from './freeTesting';
import type { FreeLayout, FreeResult, FreeSpec } from './freeTypes';
import { solo } from './layoutOps';
import { teeLayout } from './tee';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const onGrid = (n: number) => Math.round(n * 2) === n * 2;

let lastOp = '';

function step(f: FreeLayout, rnd: () => number): FreeResult {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const p = pick(f.pieces);
  const kinds: FreeSpec[] = [{ kind: 'armless' }, { kind: 'oneArm', arm: pick(['start', 'end'] as const) }, { kind: 'table' }, { kind: 'wedge' }];
  const op = f.pieces.length > 22 ? pick(['remove', 'move', 'turn']) : pick(['add', 'add', 'add', 'floor', 'remove', 'move', 'turn', 'length', 'arm', 'shared', 'back']);
  lastOp = op;
  if (op === 'add') {
    const spec = pick(kinds);
    const t = snapTargets(f, spec);
    if (!t.length) return { free: f, rejected: null };
    const at = pick(t);
    return addFree(f, spec, { to: at.to, face: at.face, ...(at.face === 'back' ? { offset: at.offset, sharedBack: rnd() < 0.5 } : {}) });
  }
  if (op === 'floor') {
    const b = buildFree(f).bounds;
    return addFree(f, pick(kinds), { x: b.maxX + 20 + Math.floor(rnd() * 40), y: Math.floor(rnd() * 80) - 20, rot: pick([0, 90, 180, 270] as const) });
  }
  if (op === 'remove') return f.pieces.length > 1 ? removeFree(f, p.id) : { free: f, rejected: null };
  if (op === 'move') {
    const rest = without(f, p.id);
    const t = rest ? snapTargets(rest, { kind: p.kind, length: p.length, arm: p.arm }) : [];
    return t.length ? moveFree(f, p.id, (({ to, face, offset, sharedBack }) => ({ to, face, offset, sharedBack }))(pick(t))) : { free: f, rejected: null };
  }
  if (op === 'turn') return turnFree(f, p.id);
  if (op === 'length') return setFreeLength(f, p.id, 20 + Math.floor(rnd() * 100) / 2 + (p.kind === 'oneArm' ? 14 : 0));
  if (op === 'arm') return setFreeArm(f, p.id, pick([null, 'start', 'end'] as const));
  if (op === 'back') {
    const backs = f.pieces.filter((q) => !isRoot(q.at) && q.at.face === 'back');
    return setFreeSharedBack(f, (backs.length ? pick(backs) : p).id, rnd() < 0.5);
  }
  const D = pick([36, 40, 44]);
  return setFreeShared(f, { D, wedgeC: pick([null, D, D + 10, D + 20]), A: pick([10, 12, 14]) });
}

describe('freeform property test', () => {
  it('2,000 random edits keep every invariant', () => {
    const rnd = mulberry32(20261106);
    const starts = [straight(1), toFree(solo(standardU())).free!, toFree(teeLayout({ total: 229, stem: 110 })).free!];
    let accepted = 0;
    const byOp: Record<string, number> = {};
    let most = 0;
    let multi = 0;
    for (let run = 0; run < 20; run++) {
      let f = starts[run % starts.length]!;
      for (let i = 0; i < 100; i++) {
        const r = step(f, rnd);
        if (r.rejected) {
          expect(r.free).toBe(f);
          continue;
        }
        if (r.free === f) continue; // a no-op
        f = r.free;
        accepted++;
        byOp[lastOp] = (byOp[lastOp] ?? 0) + 1;
        most = Math.max(most, f.pieces.length);
        const b = buildFree(f);
        if (b.groups.length > 1) multi++;
        expect(b.errors, JSON.stringify(f.pieces)).toEqual([]);
        for (const pose of b.poses.values()) expect(onGrid(pose.x) && onGrid(pose.y)).toBe(true);
        const seen = new Set<string>();
        for (const p of f.pieces) {
          if (!isRoot(p.at)) expect(seen.has(p.at.to)).toBe(true);
          seen.add(p.id);
        }
        const link = encodeFree(f);
        const d = decodeFree(link);
        expect('free' in d, link).toBe(true);
        if ('free' in d) expect(encodeFree(d.free)).toBe(link);
      }
    }
    expect(accepted).toBeGreaterThan(800);
    // Every kind of edit really happened, layouts grew, and some held several sofas.
    for (const op of ['add', 'floor', 'remove', 'move', 'turn', 'length', 'arm', 'shared', 'back']) expect(byOp[op] ?? 0, `${op}: ${JSON.stringify(byOp)}`).toBeGreaterThan(10);
    expect(most).toBeGreaterThan(15);
    expect(multi).toBeGreaterThan(50);
  });
});
