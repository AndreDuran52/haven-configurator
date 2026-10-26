// An unreadable saved list is never overwritten before its exact text is copied
// aside (Andre, UX Phase 1, 2026-10-02: "never block saving during an
// appointment"). The copy is checked; only then may a fresh list replace it,
// and the Projects home shows a warning until dismissed. Nothing is deleted.
import { KEYS, readItem, readJson, removeItem, writeItem } from './storage';

export const RECOVERED_PREFIX = 'haven:saved:recovered-';

export interface Recovered {
  key: string;
  at: number;
}

/** Copy the unreadable list text aside once. False when the copy could not be made (then nothing may overwrite it). */
export function secureRaw(raw: string, now = Date.now()): boolean {
  const flag = readJson<Recovered>(KEYS.savedRecovered);
  if (flag && typeof flag.key === 'string' && readItem(flag.key) === raw) return true;
  const key = `${RECOVERED_PREFIX}${now}`;
  if (!writeItem(key, raw) || readItem(key) !== raw) return false;
  writeItem(KEYS.savedRecovered, JSON.stringify({ key, at: now } satisfies Recovered));
  return true;
}

/** The recovery to warn about on the Projects home, or null. */
export function recoveredNotice(): Recovered | null {
  const flag = readJson<Recovered>(KEYS.savedRecovered);
  return flag && typeof flag.key === 'string' && readItem(flag.key) !== null ? flag : null;
}

/** Hide the warning; the recovered copy stays on the device. */
export function dismissRecovered(): void {
  removeItem(KEYS.savedRecovered);
}
