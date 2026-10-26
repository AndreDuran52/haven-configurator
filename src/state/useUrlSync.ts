// Committed layout -> URL hash (debounced replaceState, never on drafts), and an
// outside hashchange (pasted link, Back button) -> one undoable commit.
import { useEffect } from 'react';
import { useHaven, useHavenStore } from './store';
import { DAMAGED_MESSAGE, NEWER_MESSAGE, decodeHash, urlFor } from './url';

export const URL_SYNC_MS = 300;

export function useUrlSync(): void {
  const store = useHavenStore();
  const layout = useHaven((s) => s.layout);
  const home = useHaven((s) => s.ui.screen === 'home');

  useEffect(() => {
    const t = window.setTimeout(() => {
      // replaceState, not location.hash: no history entry per edit, no hashchange.
      // The Projects home has no layout in the URL: a reload there stays home.
      const url = home ? `${window.location.pathname}${window.location.search}` : urlFor(window.location, layout);
      window.history.replaceState(window.history.state, '', url);
    }, URL_SYNC_MS);
    return () => window.clearTimeout(t);
  }, [layout, home]);

  useEffect(() => {
    const onHash = () => {
      const d = decodeHash(window.location.hash);
      if (!d) return;
      const s = store.getState();
      if ('layout' in d) return s.ui.screen === 'home' ? s.open(d.layout) : s.commitLayout(d.layout, { key: 'link' });
      s.toast(d.error === 'newer' ? NEWER_MESSAGE : DAMAGED_MESSAGE);
      // Keep the current layout in the URL, so a reload doesn't lose it.
      window.history.replaceState(window.history.state, '', urlFor(window.location, s.layout));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [store]);
}
