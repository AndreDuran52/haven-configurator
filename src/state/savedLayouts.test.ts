import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode } from '@/engine';
import { canon, fixtures } from '@/engine/testing';
import { deleteSaved, duplicateSaved, exportSaved, importSaved, listSaved, openSaved, renameSaved, saveLayout, SAVED_CAP, updateSaved } from './savedLayouts';

function memoryStorage(throwing = false): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => {
      if (throwing) throw new Error('blocked');
      return m.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (throwing) throw new Error('blocked');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('saved layouts (plan §8, H6)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('save, list newest first, rename, duplicate, delete', () => {
    const f = fixtures();
    const a = saveLayout('Mitchell', f.T1!, 1)!;
    const b = saveLayout('Garcia', f.T4!, 2)!;
    expect(listSaved().map((x) => x.name)).toEqual(['Garcia', 'Mitchell']);
    expect(renameSaved(a.id, 'Mitchell, family room')).toBe(true);
    const c = duplicateSaved(b.id, 3)!;
    expect(listSaved().map((x) => x.name)).toEqual(['Garcia (copy)', 'Garcia', 'Mitchell, family room']);
    expect(deleteSaved(c.id)).toBe(true);
    expect(listSaved()).toHaveLength(2);
  });

  it('every §12 fixture survives a saved-layout round trip', () => {
    for (const [name, c] of Object.entries(fixtures())) {
      const e = saveLayout(name, c)!;
      expect(canon(openSaved(e)!), name).toEqual(canon(c));
      expect(encode(openSaved(e)!)).toBe(encode(c));
    }
  });

  it('caps the list at 200', () => {
    const c = fixtures().T1!;
    for (let i = 0; i < SAVED_CAP + 5; i++) saveLayout(`L${i}`, c, i);
    expect(listSaved()).toHaveLength(SAVED_CAP);
    expect(listSaved()[0]!.name).toBe(`L${SAVED_CAP + 4}`);
  });

  it('storage throwing: an empty list, and save reports failure', () => {
    vi.stubGlobal('localStorage', memoryStorage(true));
    expect(listSaved()).toEqual([]);
    expect(saveLayout('x', fixtures().T1!)).toBeNull();
  });

  it('H6b: updateSaved overwrites a project in place and moves it to the top', () => {
    const f = fixtures();
    const a = saveLayout('Mitchell', f.T1!, 1)!;
    saveLayout('Garcia', f.T4!, 2);
    const u = updateSaved(a.id, f.T2!, 3)!;
    expect(u).toMatchObject({ id: a.id, name: 'Mitchell', code: encode(f.T2!), savedAt: 3 });
    expect(listSaved().map((x) => x.name)).toEqual(['Mitchell', 'Garcia']);
    expect(updateSaved('nope', f.T1!)).toBeNull();
  });

  it('H6b: a backup restores on another device; restoring again adds nothing; newer copies win', () => {
    const f = fixtures();
    saveLayout('Mitchell', f.T1!, 1);
    const g = saveLayout('Garcia', f.T4!, 2)!;
    const file = exportSaved(10);
    expect(JSON.parse(file)).toMatchObject({ app: 'haven-configurator', kind: 'projects', version: 1, exportedAt: 10 });
    vi.stubGlobal('localStorage', memoryStorage()); // the other device
    expect(importSaved(file)).toEqual({ added: 2, updated: 0, skipped: 0 });
    expect(listSaved().map((x) => x.name)).toEqual(['Garcia', 'Mitchell']);
    expect(importSaved(file)).toEqual({ added: 0, updated: 0, skipped: 2 });
    updateSaved(g.id, f.T2!, 1); // older here than in the file
    expect(importSaved(file)).toEqual({ added: 0, updated: 1, skipped: 1 });
    expect(encode(openSaved(listSaved().find((x) => x.id === g.id)!)!)).toBe(encode(f.T4!));
  });

  it('H6b: a bare list is accepted; damaged codes and junk are skipped or refused', () => {
    const ok = { id: 'a', name: 'A', code: encode(fixtures().T1!), savedAt: 5 };
    expect(importSaved(JSON.stringify([ok, { ...ok, id: 'b', code: 'garbage' }, { nope: 1 }]))).toEqual({ added: 1, updated: 0, skipped: 2 });
    expect(importSaved('not json')).toEqual({ error: 'notBackup' });
    expect(importSaved('{"projects": 3}')).toEqual({ error: 'notBackup' });
    vi.stubGlobal('localStorage', memoryStorage(true));
    expect(importSaved(JSON.stringify([{ ...ok, id: 'c' }]))).toEqual({ error: 'storage' });
  });
});
