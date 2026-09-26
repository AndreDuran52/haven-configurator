// The app shell (plan §4, §8): full screen, no page scroll, safe areas. Wide
// screens (iPad landscape, laptop): plan on the left, controls on the right.
// Narrow screens (iPad portrait, phones): plan on top, controls below it.
import { lazy, Suspense, useEffect } from 'react';
import { PlanView } from '@/plan/PlanView';
import { useHaven } from '@/state/store';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { TopBar } from './TopBar';
import { UpdateChip } from './UpdateChip';
import { ViewBar } from './ViewBar';
import { loadThreeView, warm3d } from './warm3d';
import { WedgeSlider } from './WedgeSlider';

// The whole 3D stack loads only through here (CLAUDE.md rule 4).
const ThreeView = lazy(loadThreeView);

export function HavenLayout() {
  const view = useHaven((s) => s.ui.view);
  useEffect(() => warm3d(window), []);
  return (
    <div className="haven-layout grid h-dvh bg-canvas text-ink">
      <TopBar />
      <main className="haven-main min-h-0">
        <section className="haven-plan flex min-h-0 flex-col">
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
          <div className="safe-x border-t border-line bg-panel px-3 py-2">
            <WedgeSlider />
          </div>
        </section>
        <aside className="haven-side safe-bottom safe-x min-h-0 overflow-y-auto overscroll-contain border-line bg-panel p-4">
          <Sidebar />
        </aside>
      </main>
      <Toast />
      <UpdateChip />
    </div>
  );
}
