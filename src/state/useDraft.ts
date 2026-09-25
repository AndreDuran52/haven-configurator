import { useEffect } from 'react';
import { DRAFT_DELAY_MS, saveDraft } from './draft';
import { useHaven } from './store';

/** Writes the committed config as the device draft 1 s after each commit. */
export function useDraft(): void {
  const config = useHaven((s) => s.config);
  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(config), DRAFT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [config]);
}
