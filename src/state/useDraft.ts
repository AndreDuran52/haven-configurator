import { useEffect, useRef } from 'react';
import { DRAFT_DELAY_MS, saveDraft } from './draft';
import { useHaven } from './store';

/**
 * Writes the committed config as the device draft 1 s after each commit. Never
 * on open: the layout the app opens with must not overwrite yesterday's draft
 * ("Resume last layout").
 */
export function useDraft(): void {
  const config = useHaven((s) => s.config);
  const opened = useRef(config);
  useEffect(() => {
    if (config === opened.current) return;
    const t = window.setTimeout(() => saveDraft(config), DRAFT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [config]);
}
