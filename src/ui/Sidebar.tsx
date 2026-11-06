// The side panel (plan §8; editor redesign, Andre 2026-11-06): the shape
// picker on top, then three tabs: Size (measurements, the corner wedge, seat
// and arm width, warnings), Pieces (the add-piece tray, table style) and Look
// (fabric, wood, pillows, plan style). Pieces and Look load on first open.
import { lazy, Suspense } from 'react';
import { buildInfo } from '@/buildInfo';
import { layoutBuiltOf, useHaven, useHavenStore, useLiveLayout, type PanelTab } from '@/state/store';
import { ShapePicker } from './ShapePicker';
import { SizeTab } from './SizeTab';

const PiecesTab = lazy(() => import('./PiecesTab'));
const LookSection = lazy(() => import('./LookSection').then((m) => ({ default: m.LookSection })));

const TABS: { value: PanelTab; label: string }[] = [
  { value: 'size', label: 'Size' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'look', label: 'Look' },
];

export function Sidebar() {
  const store = useHavenStore();
  const tab = useHaven((s) => s.ui.panel);
  const warnings = layoutBuiltOf(useLiveLayout()).warnings.length;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ShapePicker />
      <div role="tablist" aria-label="Panel" className="flex border-b border-line" data-testid="panel-tabs">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={tab === t.value}
            aria-controls={`panel-${t.value}`}
            onClick={() => store.getState().setUi({ panel: t.value })}
            className={`-mb-px flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-sm font-semibold ${tab === t.value ? 'border-accent text-ink' : 'border-transparent text-ink-muted'}`}
          >
            {t.label}
            {t.value === 'size' && warnings > 0 && (
              <span className="rounded-full bg-warn-bg px-1.5 text-xs leading-5 font-semibold text-warn-ink tabular-nums" aria-label={`${warnings} warning${warnings > 1 ? 's' : ''}`} data-testid="warn-badge">
                {warnings}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex min-w-0 flex-col gap-5">
        {tab === 'size' && <SizeTab />}
        <Suspense fallback={null}>
          {tab === 'pieces' && <PiecesTab />}
          {tab === 'look' && <LookSection />}
        </Suspense>
      </div>
      <p className="mt-auto text-xs text-ink-muted" data-testid="build">
        Haven Configurator · build <span className="font-mono">{buildInfo.commit}</span>
      </p>
    </div>
  );
}
