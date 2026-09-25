// The localStorage draft (plan §8): the last committed layout as a codec
// string, written 1 s after each commit and offered as "Resume last layout".
import { decode, encode, type Config } from '@/engine';
import { KEYS, readJson, writeItem } from './storage';

export const DRAFT_DELAY_MS = 1000;

interface StoredDraft {
  code: string;
  savedAt: number;
}

export function saveDraft(c: Config, now = Date.now()): boolean {
  return writeItem(KEYS.draft, JSON.stringify({ code: encode(c), savedAt: now } satisfies StoredDraft));
}

export function readDraft(): { config: Config; savedAt: number } | null {
  const d = readJson<StoredDraft>(KEYS.draft);
  if (!d || typeof d.code !== 'string') return null;
  const r = decode(d.code);
  return 'config' in r ? { config: r.config, savedAt: Number(d.savedAt) || 0 } : null;
}
