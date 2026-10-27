// Undo/redo around a draft slot (plan §8 "Undo / redo"), as pure functions so
// the store stays thin and this is unit-tested on its own. Generic over the
// domain state: the store keeps a history of whole Layouts (shapes milestone),
// so one undo step restores every section together.
// - Only `present` is domain state; `draft` previews a gesture (renderers use draft ?? present).
// - commit() skips a same-reference result (engine refusals / no-ops).
// - The same key within COALESCE_MS replaces the top step (steppers, key nudges).
// - undo/redo are ignored while a draft is live.

export interface History<T> {
  present: T;
  draft: T | null;
  past: T[];
  future: T[];
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 800;

export const initHistory = <T>(present: T): History<T> => ({
  present,
  draft: null,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
});

export const setDraft = <T>(h: History<T>, draft: T): History<T> => ({ ...h, draft });
export const cancelDraft = <T>(h: History<T>): History<T> => (h.draft ? { ...h, draft: null } : h);

export interface CommitOptions {
  key?: string;
  now?: number;
}

export function commit<T>(h: History<T>, next?: T, opts: CommitOptions = {}): History<T> {
  const target = next ?? h.draft;
  if (!target || target === h.present) return h.draft ? { ...h, draft: null } : h;
  const now = opts.now ?? Date.now();
  const coalesce = !!opts.key && opts.key === h.lastKey && now - h.lastAt < COALESCE_MS && h.past.length > 0;
  return {
    present: target,
    draft: null,
    past: coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
    future: [],
    lastKey: opts.key ?? null,
    lastAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (!prev || h.draft) return h;
  return { ...h, present: prev, past: h.past.slice(0, -1), future: [h.present, ...h.future], lastKey: null };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (!next || h.draft) return h;
  return { ...h, present: next, past: [...h.past, h.present], future: h.future.slice(1), lastKey: null };
}
