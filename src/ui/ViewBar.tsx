// The bar over the plan / 3D box (plan §7.2; UX Phase 3, Andre 2026-11-08):
// Plan | 3D; in the plan, Dimensions Overall | Detailed; in 3D the cameras
// Overview, Top, Front, Side (3/4 and Iso are one Overview; Top is back since
// Phase 3b); and a small View menu (Pillows in the plan and 3D; Plan style in
// the plan only; Seating: seat markers, Snug, seat width). Rule for every menu (Andre, 2026-11-09): only options that do
// something in the current view. At the right end: Hide panel | Show panel (UX
// Phase 5, 2026-11-11). A camera button returns to its exact view even
// when it's already on. In the entry chunk: it imports only three-free modules
// (ortho/presets), so no three.js.
import { lazy, Suspense } from 'react';
import { isElevation, type PresetName } from '@/ortho/presets';
import { writeDimsMode, writePanelHidden } from '@/state/prefs';
import { useHaven, useHavenStore, useLive } from '@/state/store';
import { Menu } from './Menu';
// The Seating section loads when the menu first opens (it stays out of the entry chunk).
const SeatingSection = lazy(() => import('./SeatingSection').then((m) => ({ default: m.SeatingSection })));
// The Person section (3D only) loads with the menu too.
const PersonSection = lazy(() => import('./PersonSection').then((m) => ({ default: m.PersonSection })));
import { Toggle } from './Toggle';

/** The 3D cameras offered (UX Phase 3; Top again in 3b): Overview is the 3/4 view. */
const CAMERAS: { preset: PresetName; label: string }[] = [
  { preset: 'threeQuarter', label: 'Overview' },
  { preset: 'top', label: 'Top' },
  { preset: 'front', label: 'Front' },
  { preset: 'side', label: 'Side' },
];

// Phones: tighter pills so the groups fit one row above the 3D box (top-15).
const pill = (on: boolean) =>
  `min-h-11 min-w-11 rounded-lg px-2 min-[480px]:px-3 text-[15px] font-semibold ${on ? 'bg-ink text-canvas' : 'bg-transparent text-ink hover-hover:bg-panel-2'}`;
const group = 'pointer-events-auto flex gap-0.5 rounded-xl border border-line bg-panel p-1 shadow-sm min-[480px]:gap-1';

export function ViewBar() {
  const store = useHavenStore();
  // A T (Shapes B1) has no 3D: only the plan.
  const joined = useHaven((s) => s.layout.sections.length > 1);
  const view = useHaven((s) => (s.layout.sections.length > 1 ? 'plan' : s.ui.view));
  const preset = useHaven((s) => s.ui.preset);
  const showLoose = useHaven((s) => s.ui.showLoose);
  const dims = useHaven((s) => s.ui.dims);
  const look = useHaven((s) => s.ui.look);
  const pillows = useHaven((s) => s.ui.pillows);
  const hasLoose = useLive().loose.length > 0;
  const panelHidden = useHaven((s) => s.ui.panelHidden);
  const readOnly = useHaven((s) => s.ui.readOnly);
  const setUi = store.getState().setUi;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-1.5 p-1.5 min-[480px]:gap-2 min-[480px]:p-2">
      <div role="radiogroup" aria-label="View" className={group}>
        {(joined ? (['plan'] as const) : (['plan', '3d'] as const)).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} className={pill(view === v)} onClick={() => store.getState().setView(v)}>
            {v === 'plan' ? 'Plan' : '3D'}
          </button>
        ))}
      </div>
      {view === 'plan' && (
        <div role="radiogroup" aria-label="Dimensions" className={group} data-testid="dims-mode">
          {(['overall', 'detailed'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={dims === m}
              className={pill(dims === m)}
              onClick={() => {
                writeDimsMode(m);
                setUi({ dims: m });
              }}
            >
              {m === 'overall' ? 'Overall' : 'Detailed'}
            </button>
          ))}
        </div>
      )}
      {view === '3d' && (
        <div role="radiogroup" aria-label="3D view" className={`${group} flex-wrap`} data-testid="presets">
          {CAMERAS.map((c) => (
            <button key={c.preset} type="button" role="radio" aria-checked={preset === c.preset} data-preset={c.preset} className={pill(preset === c.preset)} onClick={() => setUi({ preset: c.preset, cameraReset: store.getState().ui.cameraReset + 1 })}>
              {c.label}
            </button>
          ))}
          {hasLoose && isElevation(preset) && (
            <button type="button" aria-pressed={showLoose} className={pill(showLoose)} onClick={() => setUi({ showLoose: !showLoose })}>
              Loose pieces
            </button>
          )}
        </div>
      )}
      <div className="pointer-events-auto rounded-xl border border-line bg-panel p-1 shadow-sm">
        <Menu label="View options" testId="view-menu" button={<span>View ▾</span>}>
          {() => (
            <>
              <Toggle label="Pillows" on={pillows} onChange={(on) => setUi({ pillows: on })} testId="pillows" />
              {view === 'plan' && (
              <div className="flex flex-col gap-1.5 px-3 py-2" data-testid="plan-style">
                <span className="text-[15px] font-medium text-ink">Plan style</span>
                <div role="radiogroup" aria-label="Plan style" className="flex gap-1 rounded-lg border border-line bg-panel-2 p-0.5">
                  {(['cad', 'sketch'] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={look === v} onClick={() => setUi({ look: v })} className={`min-h-10 flex-1 rounded-md px-3 text-[15px] font-medium ${look === v ? 'bg-panel text-ink shadow-sm' : 'text-ink-muted'}`}>
                      {v === 'cad' ? 'CAD' : 'Sketch'}
                    </button>
                  ))}
                </div>
              </div>
              )}
              <Suspense fallback={null}>
                <SeatingSection view={view} preset={preset} />
                {view === '3d' && <PersonSection />}
              </Suspense>
            </>
          )}
        </Menu>
      </div>
      {/* UX Phase 5 (Andre, 2026-11-11): hide the side panel so the plan or 3D fills the screen (per device). */}
      {!readOnly && (
        <div className={`${group} ml-auto`}>
          <button
            type="button"
            aria-pressed={panelHidden}
            data-testid="panel-toggle"
            className={pill(false)}
            onClick={() => {
              writePanelHidden(!panelHidden);
              setUi({ panelHidden: !panelHidden });
            }}
          >
            {panelHidden ? '« Show panel' : 'Hide panel »'}
          </button>
        </div>
      )}
    </div>
  );
}
