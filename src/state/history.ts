// Undo/redo around a draft slot (plan §8 "Undo / redo"), as pure functions so
// the store stays thin and this is unit-tested on its own.
// - Only `config` is domain state; `draft` previews a gesture (renderers use draft ?? config).
// - commit() skips a same-reference result (engine refusals / no-ops).
// - The same key within COALESCE_MS replaces the top step (steppers, key nudges).
// - undo/redo are ignored while a draft is live.
import type { Config } from '@/engine';

export interface History {
  config: Config;
  draft: Config | null;
  past: Config[];
  future: Config[];
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 800;

export const initHistory = (config: Config): History => ({
  config,
  draft: null,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
});

export const setDraft = (h: History, draft: Config): History => ({ ...h, draft });
export const cancelDraft = (h: History): History => (h.draft ? { ...h, draft: null } : h);

export interface CommitOptions {
  key?: string;
  now?: number;
}

export function commit(h: History, next?: Config, opts: CommitOptions = {}): History {
  const target = next ?? h.draft;
  if (!target || target === h.config) return h.draft ? { ...h, draft: null } : h;
  const now = opts.now ?? Date.now();
  const coalesce = !!opts.key && opts.key === h.lastKey && now - h.lastAt < COALESCE_MS && h.past.length > 0;
  return {
    config: target,
    draft: null,
    past: coalesce ? h.past : [...h.past, h.config].slice(-HISTORY_LIMIT),
    future: [],
    lastKey: opts.key ?? null,
    lastAt: now,
  };
}

export function undo(h: History): History {
  const prev = h.past[h.past.length - 1];
  if (!prev || h.draft) return h;
  return { ...h, config: prev, past: h.past.slice(0, -1), future: [h.config, ...h.future], lastKey: null };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (!next || h.draft) return h;
  return { ...h, config: next, past: [...h.past, h.config], future: h.future.slice(1), lastKey: null };
}
