// The app shell (plan §4, §8): full screen, no page scroll, safe areas. Wide
// screens (iPad landscape, laptop): plan on the left, controls on the right.
// Narrow screens (iPad portrait, phones): plan on top, controls below it.
// Since the editor redesign (2026-11-06) nothing sits under the plan: the tray
// and the wedge slider are in the side panel's tabs, so the plan is taller.
// UX Phase 5 (Andre, 2026-11-11): the panel can be hidden (the view bar's
// Hide panel), so the plan or 3D takes the whole screen under the top bar.
import { lazy, Suspense, useEffect } from 'react';
import { PlanView } from '@/plan/PlanView';
import { useHaven, useHavenStore } from '@/state/store';
import { ResultLine } from './ResultLine';
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
// ?view only.
const ViewSummary = lazy(() => import('./ViewSummary').then((m) => ({ default: m.ViewSummary })));

export function HavenLayout() {
  // Shapes B1: a T has no 3D yet (B2), so it always shows the plan; ui.view is kept for later.
  const view = useHaven((s) => (s.layout.sections.length > 1 ? 'plan' : s.ui.view));
  const selected = useHaven((s) => s.ui.selectedId !== null);
  const readOnly = useHaven((s) => s.ui.readOnly);
  const tableDrag = useHaven((s) => s.ui.dragging === 'table');
  // UX Phase 5: the side panel hidden (never in ?view, which shows its summary there).
  const full = useHaven((s) => s.ui.panelHidden && !s.ui.readOnly);
  useEffect(() => warm3d(window), []);
  useGlobalKeys(useHavenStore());
  return (
    <div className="haven-layout grid h-dvh bg-canvas text-ink">
      <TopBar />
      <main className={`haven-main min-h-0 ${full ? 'haven-main--full' : ''}`}>
        <section className="haven-plan flex min-h-0 min-w-0 flex-col">
          <div className="relative min-h-0 flex-1">
            {/* Plan and 3D share one box under the view bar: same size = parity hand-off. */}
            {/* The bottom strip is kept for the result line, so the plan never re-fits when it shows. */}
            <div className={`absolute inset-x-0 top-15 ${readOnly ? 'bottom-0' : 'bottom-16'}`}>
              {view === 'plan' ? (
                <PlanView />
              ) : (
                <Suspense fallback={<p className="p-4 text-sm text-ink-muted">Loading 3D…</p>}>
                  <ThreeView />
                </Suspense>
              )}
            </div>
            <ViewBar />
            {!readOnly && <ResultLine />}
            {/* A table dragged here is removed (the gesture hit-tests [data-trash]). */}
            {tableDrag && (
              <div
                data-trash=""
                className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex h-14 items-center justify-center rounded-lg border-2 border-dashed border-danger bg-panel/90 text-sm font-semibold text-danger"
              >
                Drop here to remove the table
              </div>
            )}
          </div>
        </section>
        {!full && (
          <aside className="haven-side safe-bottom safe-x min-h-0 overflow-y-auto overscroll-contain border-line bg-panel p-4">
            {readOnly ? (
              <Suspense fallback={null}>
                <ViewSummary />
              </Suspense>
            ) : (
              <Sidebar />
            )}
          </aside>
        )}
      </main>
      <Suspense fallback={null}>{selected && view === 'plan' && <TapMenu />}</Suspense>
      <Toast />
      <UpdateChip />
    </div>
  );
}
