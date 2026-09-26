// Every localStorage read/write goes through here (CLAUDE.md rule 9). Storage
// can throw (private mode, blocked site data, quota); the app must keep working
// without it, so every call is wrapped and failures read as "nothing stored".
export const KEYS = {
  draft: 'haven:draft',
} as const;

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readItem(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the write did not happen. */
export function writeItem(key: string, value: string): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // ignore: nothing we can do
  }
}

export function readJson<T>(key: string): T | null {
  const raw = readItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
