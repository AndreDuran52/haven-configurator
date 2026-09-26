// App root (plan §4): the store is created once from the URL (hash, then the
// Standard U; ?view = read-only), then the layout, URL sync and draft hooks.
import { useState } from 'react';
import { HavenStoreProvider, createHavenStore } from '@/state/store';
import { initialConfig, isViewMode } from '@/state/url';
import { useDraft } from '@/state/useDraft';
import { useUrlSync } from '@/state/useUrlSync';
import { HavenLayout } from '@/ui/HavenLayout';

function makeStore() {
  const { config, message } = initialConfig(window.location.hash);
  const store = createHavenStore(config, { readOnly: isViewMode(window.location.search) });
  if (message) store.getState().toast(message);
  // For the e2e checks (judged against the committed config, never mutated there).
  (window as unknown as { __haven?: unknown }).__haven = store;
  return store;
}

function Effects() {
  useUrlSync();
  useDraft();
  return null;
}

export default function App() {
  const [store] = useState(makeStore);
  return (
    <HavenStoreProvider store={store}>
      <Effects />
      <HavenLayout />
    </HavenStoreProvider>
  );
}
