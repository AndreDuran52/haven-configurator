// App root (plan §4): the store is created once from the URL (hash, then the
// Standard U; ?view = read-only), then the layout, URL sync and draft hooks.
// H6b: with no layout in the URL the app opens to the Projects home.
import { lazy, Suspense, useState } from 'react';
import { HavenStoreProvider, createHavenStore, useHaven } from '@/state/store';
import { codeFromHash, initialConfig, isViewMode } from '@/state/url';
import { restoreOpenProject, useOpenProject } from '@/state/openProject';
import { useDraft } from '@/state/useDraft';
import { useUrlSync } from '@/state/useUrlSync';
import { HavenLayout } from '@/ui/HavenLayout';
import { Toast } from '@/ui/Toast';

function makeStore() {
  const { config, message } = initialConfig(window.location.hash);
  const readOnly = isViewMode(window.location.search);
  // H6b: a link (even a damaged one) or ?view opens the editor; a plain open, the Projects home.
  const screen = readOnly || codeFromHash(window.location.hash) !== null ? 'editor' : 'home';
  // A reload keeps the open project (Save keeps updating it), only for the same layout.
  const project = screen === 'editor' && !readOnly ? restoreOpenProject(config) : null;
  const store = createHavenStore(config, { readOnly, screen, project });
  if (message) store.getState().toast(message);
  // For the e2e checks (judged against the committed config, never mutated there).
  (window as unknown as { __haven?: unknown }).__haven = store;
  return store;
}

function Effects() {
  useUrlSync();
  useDraft();
  useOpenProject();
  return null;
}

const ProjectsHome = lazy(() => import('@/ui/ProjectsHome'));

function Screens() {
  const home = useHaven((s) => s.ui.screen === 'home');
  return home ? (
    <Suspense fallback={<div className="h-dvh bg-canvas" />}>
      <ProjectsHome />
      <Toast />
    </Suspense>
  ) : (
    <HavenLayout />
  );
}

export default function App() {
  const [store] = useState(makeStore);
  return (
    <HavenStoreProvider store={store}>
      <Effects />
      <Screens />
    </HavenStoreProvider>
  );
}
