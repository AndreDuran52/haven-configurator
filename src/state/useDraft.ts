import { useEffect } from 'react';
import { DRAFT_DELAY_MS, saveDraft } from './draft';
import { useHaven } from './store';

/**
 * Writes the committed config as the device draft 1 s after each commit. Never
 * on open (the app's first layout, or one opened from the Projects home: a
 * fresh history): that must not overwrite yesterday's draft ("Continue last layout").
 */
export function useDraft(): void {
  const config = useHaven((s) => s.config);
  const fresh = useHaven((s) => s.past.length === 0 && s.future.length === 0);
  useEffect(() => {
    if (fresh) return;
    const t = window.setTimeout(() => saveDraft(config), DRAFT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [config, fresh]);
}
