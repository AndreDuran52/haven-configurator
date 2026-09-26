import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode } from '@/engine';
import { canon, fixtures } from '@/engine/testing';
import { deleteSaved, duplicateSaved, listSaved, openSaved, renameSaved, saveLayout, SAVED_CAP } from './savedLayouts';

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
});
