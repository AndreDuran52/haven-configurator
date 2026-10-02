// The project open in the editor survives a reload (UX Phase 1, 2026-10-02):
// without this, a reload (or the Update chip) kept the layout but forgot the
// project, and the next Save made a second one. `haven:open` holds the project
// id and the layout code last seen; it is restored only when the URL still
// carries that exact layout, so a different link never attaches to a project.
import { useEffect, useRef } from 'react';
import { encode, type Config } from '@/engine';
import { listSaved, openSaved } from './savedLayouts';
import { KEYS, readJson, removeItem, writeItem } from './storage';
import { useHaven, type UiState } from './store';

interface StoredOpen {
  id: string;
  code: string;
}

/** The saved project (as it is stored) for an id, or null when it is gone or damaged. */
export function projectFor(id: string | null | undefined): UiState['project'] {
  const e = id ? listSaved().find((x) => x.id === id) : undefined;
  const c = e && openSaved(e);
  return e && c ? { id: e.id, name: e.name, code: encode(c) } : null;
}

/** At boot: the open project, if the URL's layout is the one last seen with it. */
export function restoreOpenProject(config: Config): UiState['project'] {
  const o = readJson<StoredOpen>(KEYS.open);
  if (!o || typeof o.id !== 'string' || o.code !== encode(config)) return null;
  return projectFor(o.id);
}

/**
 * Keeps `haven:open` current. It is cleared only when THIS tab leaves its
 * project (home, or a layout without one), never by another tab merely opening
 * a link: that tab's reload must still find its project.
 */
export function useOpenProject(): void {
  const project = useHaven((s) => s.ui.project);
  const home = useHaven((s) => s.ui.screen === 'home');
  const config = useHaven((s) => s.config);
  const had = useRef(false);
  useEffect(() => {
    if (!home && project) {
      had.current = true;
      writeItem(KEYS.open, JSON.stringify({ id: project.id, code: encode(config) } satisfies StoredOpen));
    } else if (had.current) {
      had.current = false;
      removeItem(KEYS.open);
    }
  }, [project, home, config]);
}
