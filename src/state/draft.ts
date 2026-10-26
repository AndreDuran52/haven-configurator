// The localStorage draft (plan §8): the last committed layout as a codec
// string, written 1 s after each commit and offered as "Resume last layout".
import { decodeLayout, type Layout } from '@/engine';
import { canOpen } from './layoutGate';
import { KEYS, readJson, writeItem } from './storage';
import { codeOf } from './store';

export const DRAFT_DELAY_MS = 1000;

interface StoredDraft {
  code: string;
  savedAt: number;
  /** The saved project this layout was opened from (UX Phase 1), so Continue keeps saving into it. */
  projectId?: string;
}

export function saveDraft(l: Layout, now = Date.now(), projectId?: string): boolean {
  return writeItem(KEYS.draft, JSON.stringify({ code: codeOf(l), savedAt: now, ...(projectId ? { projectId } : {}) } satisfies StoredDraft));
}

export function readDraft(): { layout: Layout; savedAt: number; projectId: string | null } | null {
  const d = readJson<StoredDraft>(KEYS.draft);
  if (!d || typeof d.code !== 'string') return null;
  const r = decodeLayout(d.code);
  if (!('layout' in r) || !canOpen(r.layout)) return null;
  return { layout: r.layout, savedAt: Number(d.savedAt) || 0, projectId: typeof d.projectId === 'string' ? d.projectId : null };
}
