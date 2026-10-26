import { useEffect } from 'react';
import { DRAFT_DELAY_MS, saveDraft } from './draft';
import { useHaven, useHavenStore } from './store';

let warned = false;

/**
 * Writes the committed config as the device draft 1 s after each commit. Never
 * on open (the app's first layout, or one opened from the Projects home: a
 * fresh history): that must not overwrite yesterday's draft ("Continue last layout").
 * It remembers the open project, so Continue keeps saving into it.
 */
export function useDraft(): void {
  const store = useHavenStore();
  const config = useHaven((s) => s.config);
  const fresh = useHaven((s) => s.past.length === 0 && s.future.length === 0);
  const projectId = useHaven((s) => s.ui.project?.id);
  useEffect(() => {
    if (fresh) return;
    const t = window.setTimeout(() => {
      // A failed write is said once (UX Phase 1), never silently dropped every time.
      if (!saveDraft(config, Date.now(), projectId) && !warned) {
        warned = true;
        store.getState().toast("Can't keep a backup copy on this device (storage is off or full). Save or share a link.");
      }
    }, DRAFT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [config, fresh, projectId, store]);
}
