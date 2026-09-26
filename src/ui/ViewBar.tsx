// Plan | 3D switch and the 3D preset buttons (plan §7.2), in the entry chunk:
// they import only three-free modules (ortho/presets), so no three.js here.
import { PRESET_LABELS, PRESET_ORDER, isElevation } from '@/ortho/presets';
import { useHaven, useHavenStore, useLive } from '@/state/store';

const pill = (on: boolean) =>
  `min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold shadow-sm ${on ? 'bg-ink text-canvas' : 'bg-panel/95 text-ink'}`;

export function ViewBar() {
  const store = useHavenStore();
  const view = useHaven((s) => s.ui.view);
  const preset = useHaven((s) => s.ui.preset);
  const showLoose = useHaven((s) => s.ui.showLoose);
  const hasLoose = useLive().loose.length > 0;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-2 p-2">
      <div role="radiogroup" aria-label="View" className="pointer-events-auto flex gap-1 rounded-xl border border-line bg-panel/90 p-1 shadow-sm">
        {(['plan', '3d'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} className={pill(view === v)} onClick={() => store.getState().setView(v)}>
            {v === 'plan' ? 'Plan' : '3D'}
          </button>
        ))}
      </div>
      {view === '3d' && (
        <div role="radiogroup" aria-label="3D view" className="pointer-events-auto flex flex-wrap gap-1 rounded-xl border border-line bg-panel/90 p-1 shadow-sm" data-testid="presets">
          {PRESET_ORDER.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={preset === p} data-preset={p} className={pill(preset === p)} onClick={() => store.getState().setUi({ preset: p })}>
              {PRESET_LABELS[p]}
            </button>
          ))}
          {hasLoose && isElevation(preset) && (
            <button type="button" aria-pressed={showLoose} className={pill(showLoose)} onClick={() => store.getState().setUi({ showLoose: !showLoose })}>
              Loose pieces
            </button>
          )}
        </div>
      )}
    </div>
  );
}
