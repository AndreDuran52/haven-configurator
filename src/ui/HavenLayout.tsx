// The app shell (plan §4, §8): full screen, no page scroll, safe areas. Wide
// screens (iPad landscape, laptop): plan on the left, controls on the right.
// Narrow screens (iPad portrait, phones): plan on top, controls below it.
import { lazy, Suspense, useEffect } from 'react';
import { PlanView } from '@/plan/PlanView';
import { useHaven, useHavenStore } from '@/state/store';
import { PieceTray } from './PieceTray';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { TopBar } from './TopBar';
import { UpdateChip } from './UpdateChip';
import { ViewBar } from './ViewBar';
import { loadThreeView, warm3d } from './warm3d';
import { useGlobalKeys } from './useGlobalKeys';

// The whole 3D stack loads only through here (CLAUDE.md rule 4).
const ThreeView = lazy(loadThreeView);
// The tap menu (Radix Popover) loads on the first tap.
const TapMenu = lazy(() => import('./TapMenu'));
// The wedge slider (Radix Slider, ~7 kB gzip) loads right after the first paint,
// into a placeholder of its exact height (112 px): nothing moves when it arrives.
const WedgeSlider = lazy(() => import('./WedgeSlider').then((m) => ({ default: m.WedgeSlider })));
// ?view only.
const ViewSummary = lazy(() => import('./ViewSummary').then((m) => ({ default: m.ViewSummary })));

export function HavenLayout() {
  const view = useHaven((s) => s.ui.view);
  const selected = useHaven((s) => s.ui.selectedId !== null);
  const readOnly = useHaven((s) => s.ui.readOnly);
  useEffect(() => warm3d(window), []);
  useGlobalKeys(useHavenStore());
  return (
    <div className="haven-layout grid h-dvh bg-canvas text-ink">
      <TopBar />
      <main className="haven-main min-h-0">
        <section className="haven-plan flex min-h-0 min-w-0 flex-col">
          <div className="relative min-h-0 flex-1">
            {/* Plan and 3D share one box under the view bar: same size = parity hand-off. */}
            <div className="absolute inset-x-0 top-15 bottom-0">
              {view === 'plan' ? (
                <PlanView />
              ) : (
                <Suspense fallback={<p className="p-4 text-sm text-ink-muted">Loading 3D…</p>}>
                  <ThreeView />
                </Suspense>
              )}
            </div>
            <ViewBar />
          </div>
          {/* In both views: the plan and 3D boxes must stay the same size (parity hand-off). ?view: no editing. */}
          {!readOnly && (
            <div className="safe-x flex min-w-0 flex-col gap-2 border-t border-line bg-panel px-3 py-2">
              <PieceTray />
              <Suspense fallback={<div className="h-28" aria-hidden />}>
                <WedgeSlider />
              </Suspense>
            </div>
          )}
        </section>
        <aside className="haven-side safe-bottom safe-x min-h-0 overflow-y-auto overscroll-contain border-line bg-panel p-4">
          {readOnly ? (
            <Suspense fallback={null}>
              <ViewSummary />
            </Suspense>
          ) : (
            <Sidebar />
          )}
        </aside>
      </main>
      <Suspense fallback={null}>{selected && view === 'plan' && <TapMenu />}</Suspense>
      <Toast />
      <UpdateChip />
    </div>
  );
}
