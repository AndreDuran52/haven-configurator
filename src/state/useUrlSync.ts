// Committed config -> URL hash (debounced replaceState, never on drafts), and an
// outside hashchange (pasted link, Back button) -> one undoable commit.
import { useEffect } from 'react';
import { useHaven, useHavenStore } from './store';
import { DAMAGED_MESSAGE, NEWER_MESSAGE, decodeHash, urlFor } from './url';

export const URL_SYNC_MS = 300;

export function useUrlSync(): void {
  const store = useHavenStore();
  const config = useHaven((s) => s.config);

  useEffect(() => {
    const t = window.setTimeout(() => {
      // replaceState, not location.hash: no history entry per edit, no hashchange
      window.history.replaceState(window.history.state, '', urlFor(window.location, config));
    }, URL_SYNC_MS);
    return () => window.clearTimeout(t);
  }, [config]);

  useEffect(() => {
    const onHash = () => {
      const d = decodeHash(window.location.hash);
      if (!d) return;
      const s = store.getState();
      if ('config' in d) return s.commit(d.config, { key: 'link' });
      s.toast(d.error === 'newer' ? NEWER_MESSAGE : DAMAGED_MESSAGE);
      // Keep the current layout in the URL, so a reload doesn't lose it.
      window.history.replaceState(window.history.state, '', urlFor(window.location, s.config));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [store]);
}
