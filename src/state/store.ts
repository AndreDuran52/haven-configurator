// The app store (plan §4 "Store vs derived"): zustand/vanilla, created inside
// HavenStoreProvider so tests and previews can make their own. Only `config`
// is domain state; everything drawn is derived from `draft ?? config`.
import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { buildHaven, type BuildResult, type Config } from '@/engine';
import * as H from './history';
import { DEFAULT_START, type StartChoice } from './start';

export interface UiState {
  view: 'plan' | '3d';
  look: 'cad' | 'sketch';
  selectedId: string | null;
  /** The last Start-menu choice; Reset returns to its preset. */
  lastStart: StartChoice;
  /** `?view`: read-only client view (H6 presents it; H2 only preserves it). */
  readOnly: boolean;
  /** A short message (refusals, damaged links, loads). */
  toast: { text: string; at: number } | null;
}

export interface HavenState extends H.History {
  ui: UiState;
  setDraft: (next: Config) => void;
  cancelDraft: () => void;
  commit: (next?: Config, opts?: H.CommitOptions) => void;
  undo: () => void;
  redo: () => void;
  setUi: (patch: Partial<UiState>) => void;
  toast: (text: string) => void;
}

export type HavenStore = StoreApi<HavenState>;

export function createHavenStore(initial: Config, ui: Partial<UiState> = {}): HavenStore {
  return createStore<HavenState>()((set, get) => {
    const apply = (f: (h: H.History) => H.History) => {
      const s = get();
      const next = f(s);
      if (next !== s) set(next);
    };
    return {
      ...H.initHistory(initial),
      ui: { view: 'plan', look: 'cad', selectedId: null, lastStart: DEFAULT_START, readOnly: false, toast: null, ...ui },
      setDraft: (next) => apply((h) => H.setDraft(h, next)),
      cancelDraft: () => apply(H.cancelDraft),
      commit: (next, opts) => apply((h) => H.commit(h, next, opts)),
      undo: () => apply(H.undo),
      redo: () => apply(H.redo),
      setUi: (patch) => set({ ui: { ...get().ui, ...patch } }),
      toast: (text) => set({ ui: { ...get().ui, toast: { text, at: Date.now() } } }),
    };
  });
}

// buildHaven is memoised per config object (plan §4): any component can ask.
const builtCache = new WeakMap<Config, BuildResult>();
export function builtOf(c: Config): BuildResult {
  let b = builtCache.get(c);
  if (!b) builtCache.set(c, (b = buildHaven(c)));
  return b;
}

const StoreContext = createContext<HavenStore | null>(null);

export function HavenStoreProvider({ store, children }: { store: HavenStore; children: ReactNode }) {
  const [s] = useState(store);
  return createElement(StoreContext.Provider, { value: s }, children);
}

export function useHavenStore(): HavenStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useHaven outside HavenStoreProvider');
  return s;
}

export function useHaven<T>(selector: (s: HavenState) => T): T {
  return useStore(useHavenStore(), selector);
}

/** The config every view draws: the live draft during a gesture, else the committed config. */
export const useLive = (): Config => useHaven((s) => s.draft ?? s.config);
