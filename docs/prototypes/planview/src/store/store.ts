// Hand-rolled config history inside a Zustand store (the recommended option).
// Only `config` is domain state; `draft` is the transient preview during a gesture.
import { createStore } from 'zustand/vanilla'
import type { Config } from '../engine/types'

export interface UiState {
  view: 'plan' | '3d'
  look: 'cad' | 'sketch'
  selectedId: string | null
}

export interface HavenState {
  config: Config
  /** preview while a gesture is in flight; renderers use draft ?? config */
  draft: Config | null
  past: Config[]
  future: Config[]
  /** coalescing: consecutive commits with the same key inside the window replace the top step */
  lastKey: string | null
  lastAt: number
  ui: UiState
  setDraft: (next: Config) => void
  cancelDraft: () => void
  commit: (next?: Config, opts?: { key?: string; now?: number }) => void
  undo: () => void
  redo: () => void
  setUi: (patch: Partial<UiState>) => void
  load: (config: Config) => void
}

export const HISTORY_LIMIT = 100
export const COALESCE_MS = 800

export function createHavenStore(initial: Config) {
  return createStore<HavenState>()((set, get) => ({
    config: initial,
    draft: null,
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
    ui: { view: 'plan', look: 'cad', selectedId: null },
    setDraft: (next) => set({ draft: next }),
    cancelDraft: () => set({ draft: null }),
    commit: (next, opts = {}) => {
      const s = get()
      const target = next ?? s.draft
      if (!target || target === s.config) {
        // engine ops return the SAME reference for a rejected / no-op edit
        set({ draft: null })
        return
      }
      const now = opts.now ?? Date.now()
      const coalesce = !!opts.key && opts.key === s.lastKey && now - s.lastAt < COALESCE_MS && s.past.length > 0
      set({
        config: target,
        draft: null,
        past: coalesce ? s.past : [...s.past, s.config].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: opts.key ?? null,
        lastAt: now,
      })
    },
    undo: () => {
      const s = get()
      const prev = s.past[s.past.length - 1]
      if (!prev || s.draft) return
      set({ config: prev, past: s.past.slice(0, -1), future: [s.config, ...s.future], lastKey: null })
    },
    redo: () => {
      const s = get()
      const next = s.future[0]
      if (!next || s.draft) return
      set({ config: next, past: [...s.past, s.config], future: s.future.slice(1), lastKey: null })
    },
    setUi: (patch) => set({ ui: { ...get().ui, ...patch } }),
    load: (config) => get().commit(config),
  }))
}
