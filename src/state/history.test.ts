import { describe, expect, it } from 'vitest';
import { dragSeam, setLock, setMeasurements, standardU, type Config } from '@/engine';
import { commit, initHistory, redo, setDraft, cancelDraft, undo, HISTORY_LIMIT } from './history';

const u = standardU();
const seam = (c: Config, dx: number) => dragSeam(c, 'back', 1, dx).config;

describe('history (plan §8)', () => {
  it('20 draft moves + 1 commit = 1 undo step', () => {
    let h = initHistory(u);
    for (let i = 1; i <= 20; i++) h = setDraft(h, seam(u, i * 0.25)); // always from the gesture-start config
    expect(h.past).toHaveLength(0);
    h = commit(h);
    expect(h.past).toHaveLength(1);
    expect(h.config.runs.back!.map((p) => p.length)).toEqual([37, 31]);
    expect(undo(h).config).toBe(u);
  });

  it('cancel leaves no trace; refused / no-op edits create no step', () => {
    let h = setDraft(initHistory(u), seam(u, 4));
    h = cancelDraft(h);
    expect(h.draft).toBeNull();
    expect(commit(h, setLock(u, true).config)).toBe(h); // same reference -> nothing
    expect(commit(h, setMeasurements(u, { W: 140 }).config)).toBe(h); // refused -> same reference
  });

  it('6 fast nudges with one key = 1 step; after 800 ms a new step starts', () => {
    let h = initHistory(u);
    let t = 1000;
    for (let i = 0; i < 6; i++) h = commit(h, seam(h.config, 0.5), { key: 'seam:back:1', now: (t += 150) });
    expect(h.past).toHaveLength(1);
    h = commit(h, seam(h.config, 0.5), { key: 'seam:back:1', now: (t += 2000) });
    expect(h.past).toHaveLength(2);
  });

  it('undo walks back every commit, redo forward; both are ignored while a draft is live', () => {
    let h = initHistory(u);
    const steps = [seam(u, 1), setMeasurements(u, { D: 36 }).config, setMeasurements(u, { W: 300 }).config];
    for (const s of steps) h = commit(h, s);
    expect(setDraft(h, u).config).toBe(steps[2]);
    expect(undo(setDraft(h, u)).config).toBe(steps[2]);
    h = undo(h);
    expect(h.config).toBe(steps[1]);
    h = undo(undo(h));
    expect(h.config).toBe(u);
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.config).toBe(steps[0]);
    h = commit(h, steps[2]);
    expect(h.future).toEqual([]);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let h = initHistory(u);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = commit(h, setMeasurements(h.config, { W: 188 + ((i % 40) + 1) }).config);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
