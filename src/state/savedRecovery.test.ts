// UX Phase 1 (Andre, 2026-10-02): saved work is never lost to an unreadable
// list, a reload, or "Continue last layout"; saving is never blocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode, setMeasurements, standardU } from '@/engine';
import { fixtures } from '@/engine/testing';
import { readDraft, saveDraft } from './draft';
import { projectFor, restoreOpenProject } from './openProject';
import { listSaved, saveLayout } from './savedLayouts';
import { dismissRecovered, RECOVERED_PREFIX, recoveredNotice } from './savedRecovery';
import { KEYS } from './storage';

/** In-memory localStorage; `refuse` makes writes to matching keys fail like a full quota. */
function memoryStorage(refuse: (k: string) => boolean = () => false): Storage & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return {
    m,
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (refuse(k)) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
  };
}

const recoveredKeys = (m: Map<string, string>) => [...m.keys()].filter((k) => k.startsWith(RECOVERED_PREFIX));

describe('an unreadable saved list (UX Phase 1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const [label, raw] of [
    ['broken JSON', '[{"id":"s1","name":"Mitchell","code":"1UW1'],
    ['not a list', '{"projects": 3}'],
    ['a list with a broken entry', `[{"id":"s1","name":"Mitchell","code":"${encode(standardU())}","savedAt":1},{"id":7}]`],
  ] as const) {
    it(`${label}: the exact text is copied aside, then saving works on a fresh list and a warning shows`, () => {
      const s = memoryStorage();
      vi.stubGlobal('localStorage', s);
      s.m.set(KEYS.saved, raw);
      const kept = listSaved().map((x) => x.name);
      expect(recoveredKeys(s.m)).toHaveLength(1);
      expect(s.m.get(recoveredKeys(s.m)[0]!)).toBe(raw);
      expect(recoveredNotice()?.key).toBe(recoveredKeys(s.m)[0]);
      expect(saveLayout('Garcia', standardU(), 5)).not.toBeNull();
      expect(listSaved().map((x) => x.name)).toEqual(['Garcia', ...kept]);
      expect(recoveredKeys(s.m)).toHaveLength(1); // copied once, not on every read
      dismissRecovered();
      expect(recoveredNotice()).toBeNull();
      expect(s.m.get(recoveredKeys(s.m)[0]!)).toBe(raw); // the copy stays
    });
  }

  it('when the copy cannot be made, the old text is never overwritten (Save reports it)', () => {
    const s = memoryStorage((k) => k.startsWith(RECOVERED_PREFIX));
    vi.stubGlobal('localStorage', s);
    s.m.set(KEYS.saved, 'garbage');
    expect(saveLayout('Garcia', standardU())).toBeNull();
    expect(s.m.get(KEYS.saved)).toBe('garbage');
  });

  it('a readable list is never copied', () => {
    const s = memoryStorage();
    vi.stubGlobal('localStorage', s);
    saveLayout('Mitchell', standardU());
    listSaved();
    expect(recoveredKeys(s.m)).toEqual([]);
    expect(recoveredNotice()).toBeNull();
  });
});

describe('the open project survives a reload; Continue keeps its project (UX Phase 1)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('restores only when the URL still carries the layout last seen with it', () => {
    const c = fixtures().T1!;
    const e = saveLayout('Mitchell', c)!;
    const edited = setMeasurements(c, { W: 200 }).config;
    localStorage.setItem(KEYS.open, JSON.stringify({ id: e.id, code: encode(edited) }));
    const p = restoreOpenProject(edited)!;
    expect(p).toEqual({ id: e.id, name: 'Mitchell', code: encode(c) }); // the saved code: "edited" stays correct
    expect(restoreOpenProject(fixtures().T4!)).toBeNull(); // another link never attaches to the project
    localStorage.setItem(KEYS.open, JSON.stringify({ id: 'gone', code: encode(edited) }));
    expect(restoreOpenProject(edited)).toBeNull(); // a deleted project is ignored
  });

  it('the draft remembers its project; Continue finds it, or none when it was deleted', () => {
    const e = saveLayout('Garcia', standardU())!;
    saveDraft(standardU(), 7, e.id);
    expect(readDraft()).toMatchObject({ savedAt: 7, projectId: e.id });
    expect(projectFor(readDraft()!.projectId)?.name).toBe('Garcia');
    saveDraft(standardU(), 8);
    expect(readDraft()!.projectId).toBeNull();
    expect(projectFor('nope')).toBeNull();
  });
});
