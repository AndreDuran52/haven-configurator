import { afterEach, describe, expect, it, vi } from 'vitest';
import { encode, standardU } from '@/engine';
import { readDraft, saveDraft } from './draft';
import { KEYS, readItem, removeItem, writeItem } from './storage';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const throwing = (): Storage =>
  new Proxy({} as Storage, {
    get() {
      throw new DOMException('blocked', 'SecurityError');
    },
  });

afterEach(() => vi.unstubAllGlobals());

describe('storage (CLAUDE.md rule 9)', () => {
  it('reads and writes through localStorage', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(writeItem('a', '1')).toBe(true);
    expect(readItem('a')).toBe('1');
    removeItem('a');
    expect(readItem('a')).toBeNull();
  });

  it('works with storage throwing on every access (private mode / blocked)', () => {
    vi.stubGlobal('localStorage', throwing());
    expect(writeItem('a', '1')).toBe(false);
    expect(readItem('a')).toBeNull();
    expect(() => removeItem('a')).not.toThrow();
    expect(saveDraft(standardU())).toBe(false);
    expect(readDraft()).toBeNull();
  });

  it('works with the localStorage getter itself throwing', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(readItem('a')).toBeNull();
    expect(writeItem('a', '1')).toBe(false);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('the draft is a codec string; a damaged one reads as none', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(saveDraft(standardU(), 1234)).toBe(true);
    expect(JSON.parse(readItem(KEYS.draft)!)).toEqual({ code: encode(standardU()), savedAt: 1234 });
    expect(readDraft()!.savedAt).toBe(1234);
    writeItem(KEYS.draft, '{"code":"1UW188.zz","savedAt":1}');
    expect(readDraft()).toBeNull();
    writeItem(KEYS.draft, 'not json');
    expect(readDraft()).toBeNull();
  });
});
