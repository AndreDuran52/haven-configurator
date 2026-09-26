// Look (plan §10 H5): fabric and wood-finish swatches from the FABRICS /
// FINISHES data tables (both in the share link), the pillows (3D, UI only)
// and the plan style CAD | Sketch (UI only).
import { FABRICS, FINISHES, setFabric, setTableFinish, type EditResult } from '@/engine';
import { useHaven, useHavenStore, useLive } from '@/state/store';
import { Section, Segmented, Switch } from './controls';

function Swatch({ color, label, on, onClick }: { color: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 pr-3 text-sm ${on ? 'border-accent bg-panel-2 font-semibold' : 'border-line bg-panel'}`}
    >
      <span className="h-7 w-7 rounded-full border border-line shadow-inner" style={{ background: color }} aria-hidden />
      {label}
    </button>
  );
}

export function LookSection() {
  const store = useHavenStore();
  const live = useLive();
  const look = useHaven((s) => s.ui.look);
  const pillows = useHaven((s) => s.ui.pillows);
  const apply = (r: EditResult) => {
    const s = store.getState();
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config);
  };
  return (
    <Section title="Look">
      <div role="radiogroup" aria-label="Fabric" className="flex flex-wrap gap-2" data-testid="fabrics">
        {FABRICS.map((f) => (
          <Swatch key={f.key} color={f.color} label={f.name} on={live.fabric === f.key} onClick={() => apply(setFabric(store.getState().config, f.key))} />
        ))}
      </div>
      <div role="radiogroup" aria-label="Wood finish" className="flex flex-wrap gap-2" data-testid="finishes">
        {FINISHES.map((f) => (
          <Swatch key={f.key} color={f.color} label={f.name} on={live.tableFinish === f.key} onClick={() => apply(setTableFinish(store.getState().config, f.key))} />
        ))}
      </div>
      <Switch label="Pillows in 3D" checked={pillows} onChange={(on) => store.getState().setUi({ pillows: on })} />
      <div className="flex items-center gap-3">
        <span className="text-sm">Plan style</span>
        <div className="flex-1">
          <Segmented
            label="Plan style"
            value={look}
            options={[
              { value: 'cad', label: 'CAD' },
              { value: 'sketch', label: 'Sketch' },
            ]}
            onChange={(v) => store.getState().setUi({ look: v })}
          />
        </div>
      </div>
    </Section>
  );
}
