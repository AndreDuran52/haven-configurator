// The side panel (plan §8; editor redesign, Andre 2026-11-06; UX Phase 3,
// 2026-11-08; Phase 3b): the shape picker on top, then four tabs: Size (how
// much floor: measurements, depth, the corner wedge, the sofa's warnings),
// Room (where it goes), Pieces (what it's made of: the tray, "When pieces
// change", tables, arm width) and Design (fabric, wood). Room, Pieces and
// Design load on first open. The build number is in the settings menu.
import { lazy, Suspense } from 'react';
import { layoutBuiltOf, useHaven, useHavenStore, useLiveLayout, type PanelTab } from '@/state/store';
import { ShapePicker } from './ShapePicker';
import { SizeTab } from './SizeTab';
import { ROOM_CODES } from './warningCodes';

const PiecesTab = lazy(() => import('./PiecesTab'));
const RoomPanel = lazy(() => import('./RoomPanel'));
const LookSection = lazy(() => import('./LookSection').then((m) => ({ default: m.LookSection })));

const TABS: { value: PanelTab; label: string }[] = [
  { value: 'size', label: 'Size' },
  { value: 'room', label: 'Room' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'look', label: 'Design' },
];

export function Sidebar() {
  const store = useHavenStore();
  const tab = useHaven((s) => s.ui.panel);
  const all = layoutBuiltOf(useLiveLayout()).warnings;
  const room = all.filter((w) => ROOM_CODES.includes(w.code)).length;
  const counts: Partial<Record<PanelTab, number>> = { size: all.length - room, room };
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
            {(counts[t.value] ?? 0) > 0 && (
              <span
                className="rounded-full bg-warn-bg px-2 text-sm leading-6 font-semibold text-warn-ink tabular-nums"
                aria-label={`${counts[t.value]} warning${counts[t.value]! > 1 ? 's' : ''}`}
                data-testid={t.value === 'size' ? 'warn-badge' : `warn-badge-${t.value}`}
              >
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex min-w-0 flex-col gap-5">
        {tab === 'size' && <SizeTab />}
        <Suspense fallback={null}>
          {tab === 'room' && <RoomPanel />}
          {tab === 'pieces' && <PiecesTab />}
          {tab === 'look' && <LookSection />}
        </Suspense>
      </div>
    </div>
  );
}
