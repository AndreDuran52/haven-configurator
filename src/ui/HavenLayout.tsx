// The app shell (plan §4, §8): full screen, no page scroll, safe areas. Wide
// screens (iPad landscape, laptop): plan on the left, controls on the right.
// Narrow screens (iPad portrait, phones): plan on top, controls below it.
import { PlanView } from '@/plan/PlanView';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { TopBar } from './TopBar';
import { UpdateChip } from './UpdateChip';
import { WedgeSlider } from './WedgeSlider';

export function HavenLayout() {
  return (
    <div className="haven-layout grid h-dvh bg-canvas text-ink">
      <TopBar />
      <main className="haven-main min-h-0">
        <section className="haven-plan flex min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <PlanView />
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
