// The app store (plan §4 "Store vs derived"): zustand/vanilla, created inside
// HavenStoreProvider so tests and previews can make their own. The domain state
// is the Layout (shapes milestone, 2026-10-26: one sofa or joined sections);
// `config` / `draft` are the section being edited, derived by reference, so the
// editing UI keeps working on one sofa at a time. Commits on that section go
// through the engine's lift (replaceSection), which keeps the other sections'
// shared fields in step; one commit = one undo step for the whole layout.
import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { buildHaven, buildLayout, encodeLayout, replaceSection, sectionConfig, solo, type BuildResult, type Config, type Layout, type LayoutBuild, type Rejection } from '@/engine';
import { DEFAULT_PRESET, type PresetName } from '@/ortho/presets';
import type { TrayKind } from '@/plan/placementTargets';
import * as H from './history';
import { DEFAULT_START, type StartChoice } from './start';

/** The plan view's exact scale (CSS px per inch) and the plan point at its centre. */
export interface PlanFit {
  S: number;
  cx: number;
  cy: number;
}

export interface UiState {
  view: 'plan' | '3d';
  /** The active 3D preset (plan §7.2); the default is the 3/4 (top right). */
  preset: PresetName;
  /** Set once by the first Plan -> 3D switch: 3D opens at the plan's scale and centre (plan §7.2). */
  handoff: PlanFit | null;
  seen3d: boolean;
  planFit: PlanFit | null;
  /** Show loose pieces in Front / Side (hidden there by default, plan §7.4). */
  showLoose: boolean;
  look: 'cad' | 'sketch';
  /** Show the pillows in 3D (plan §10 H5); UI only, not in links. */
  pillows: boolean;
  selectedId: string | null;
  /** Tap-to-place (plan §8): a tray piece waiting for a "+" pin. */
  placing: TrayKind | null;
  /** The running plan gesture, if any (the tray turns into the trash during a table drag). */
  dragging: 'seam' | 'table' | 'reorder' | 'loose' | 'tray' | null;
  /** The last Start-menu choice; Reset returns to its preset. */
  lastStart: StartChoice;
  /** `?view`: read-only client view (H6 presents it; H2 only preserves it). */
  readOnly: boolean;
  /** A short message (refusals, damaged links, loads). */
  toast: { text: string; at: number } | null;
  /** H6b: the Projects home, or the editor (a link or `?view` opens straight into the editor). */
  screen: 'home' | 'editor';
  /** The saved project being edited (Save updates it), with the code last saved, to tell unsaved changes. UI only. */
  project: { id: string; name: string; code: string } | null;
  /** The section being edited ('a' = the root; a T has 'a' left half and 'b' right half). UI only. */
  section: string;
}

export interface CommitOpts extends H.CommitOptions {
  /** Which section `next` belongs to (default: ui.section). */
  section?: string;
}

export interface HavenState {
  /** The committed layout (domain state) and the live gesture preview. */
  layout: Layout;
  draftLayout: Layout | null;
  past: Layout[];
  future: Layout[];
  lastKey: string | null;
  lastAt: number;
  /** Derived: the edited section's config in `layout` / `draftLayout` (same references). */
  config: Config;
  draft: Config | null;
  ui: UiState;
  /** Preview the edited section as `next` (a gesture frame). */
  setDraft: (next: Config, section?: string) => void;
  setLayoutDraft: (next: Layout) => void;
  cancelDraft: () => void;
  /** Commit `next` for a section (or the live draft); a refusal (shared fields) is shown and returned. */
  commit: (next?: Config, opts?: CommitOpts) => Rejection | null;
  commitLayout: (next: Layout, opts?: H.CommitOptions) => void;
  setSection: (id: string) => void;
  undo: () => void;
  redo: () => void;
  setUi: (patch: Partial<UiState>) => void;
  setView: (view: UiState['view']) => void;
  toast: (text: string) => void;
  /** Open a layout in the editor from the Projects home: a fresh undo history (never undoable into another project). */
  open: (layout: Layout | Config, opts?: { project?: UiState['project']; lastStart?: StartChoice }) => void;
  goHome: () => void;
}

export type HavenStore = StoreApi<HavenState>;

const asLayout = (x: Layout | Config): Layout => ('sections' in x ? x : solo(x));

type Hist = H.History<Layout>;
const histOf = (s: HavenState): Hist => ({ present: s.layout, draft: s.draftLayout, past: s.past, future: s.future, lastKey: s.lastKey, lastAt: s.lastAt });

/** The store fields for a history, with the edited section derived. */
function fieldsOf(h: Hist, section: string) {
  return {
    layout: h.present,
    draftLayout: h.draft,
    past: h.past,
    future: h.future,
    lastKey: h.lastKey,
    lastAt: h.lastAt,
    config: sectionConfig(h.present, section),
    draft: h.draft ? sectionConfig(h.draft, section) : null,
  };
}

export function createHavenStore(initial: Layout | Config, ui: Partial<UiState> = {}): HavenStore {
  return createStore<HavenState>()((set, get) => {
    const apply = (f: (h: Hist) => Hist) => {
      const s = get();
      const h = histOf(s);
      const next = f(h);
      if (next !== h) set(fieldsOf(next, s.ui.section));
    };
    /** Lift a section config into the layout (same reference when unchanged or refused). */
    const lift = (base: Layout, next: Config, section: string) => replaceSection(base, section, next);
    return {
      ...fieldsOf(H.initHistory(asLayout(initial)), ui.section ?? 'a'),
      ui: {
        view: 'plan',
        preset: DEFAULT_PRESET,
        handoff: null,
        seen3d: false,
        planFit: null,
        showLoose: false,
        look: 'cad',
        pillows: true,
        selectedId: null,
        placing: null,
        dragging: null,
        lastStart: DEFAULT_START,
        readOnly: false,
        toast: null,
        screen: 'editor',
        project: null,
        section: 'a',
        ...ui,
      },
      setDraft: (next, section = get().ui.section) => {
        const r = lift(get().layout, next, section);
        if (!r.rejected) apply((h) => H.setDraft(h, r.layout));
      },
      setLayoutDraft: (next) => apply((h) => H.setDraft(h, next)),
      cancelDraft: () => apply(H.cancelDraft),
      commit: (next, opts = {}) => {
        if (!next) {
          apply((h) => H.commit(h, undefined, opts));
          return null;
        }
        const r = lift(get().layout, next, opts.section ?? get().ui.section);
        if (r.rejected) {
          apply(H.cancelDraft);
          get().toast(r.rejected.message);
          return r.rejected;
        }
        apply((h) => H.commit(h, r.layout, opts));
        return null;
      },
      commitLayout: (next, opts) => apply((h) => H.commit(h, next, opts)),
      setSection: (id) => {
        const s = get();
        const section = s.layout.sections.some((x) => x.id === id) ? id : s.layout.sections[0]!.id;
        set({ ui: { ...s.ui, section, selectedId: null }, config: sectionConfig(s.layout, section), draft: s.draftLayout ? sectionConfig(s.draftLayout, section) : null });
      },
      undo: () => apply(H.undo),
      redo: () => apply(H.redo),
      setUi: (patch) => set({ ui: { ...get().ui, ...patch } }),
      setView: (view) => {
        const u = get().ui;
        if (view === u.view) return;
        const first = view === '3d' && !u.seen3d;
        set({ ui: { ...u, view, ...(first ? { seen3d: true, handoff: u.planFit } : {}) } });
      },
      toast: (text) => set({ ui: { ...get().ui, toast: { text, at: Date.now() } } }),
      open: (layout, opts = {}) => {
        const u = get().ui;
        set({
          ...fieldsOf(H.initHistory(asLayout(layout)), 'a'),
          ui: { ...u, screen: 'editor', project: opts.project ?? null, lastStart: opts.lastStart ?? u.lastStart, selectedId: null, placing: null, dragging: null, readOnly: false, section: 'a' },
        });
      },
      goHome: () => set({ ui: { ...get().ui, screen: 'home', selectedId: null, placing: null, dragging: null } }),
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

// buildLayout is memoised per layout object; unchanged sections reuse builtOf.
const layoutCache = new WeakMap<Layout, LayoutBuild>();
export function layoutBuiltOf(l: Layout): LayoutBuild {
  let b = layoutCache.get(l);
  if (!b) layoutCache.set(l, (b = buildLayout(l, builtOf)));
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

/** Edits not yet saved: changed since the open project was last saved, or (no project) any undoable edit. */
export const isDirty = (s: HavenState): boolean => (s.ui.project ? codeOf(s.layout) !== s.ui.project.code : s.past.length > 0);
const codeCache = new WeakMap<Layout, string>();
/** The layout's link code (cached per layout object). */
export function codeOf(l: Layout): string {
  let code = codeCache.get(l);
  if (code === undefined) codeCache.set(l, (code = encodeLayout(l)));
  return code;
}

/** The config every view draws: the live draft during a gesture, else the committed config. */
export const useLive = (): Config => useHaven((s) => s.draft ?? s.config);

/** The whole layout, live (draft during a gesture). */
export const useLiveLayout = (): Layout => useHaven((s) => s.draftLayout ?? s.layout);
