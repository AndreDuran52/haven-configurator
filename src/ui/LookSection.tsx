// Look (plan §10 H5; UX Phase 3, Andre 2026-11-08): Fabric and Wood, each its
// own section with big swatches and names (both are in the share link). The
// pillows and the plan style moved to the View menu over the plan.
import { FABRICS, FINISHES, setFabric, setTableFinish, type EditResult } from '@/engine';
import { useHavenStore, useLive } from '@/state/store';
import { Section } from './controls';

function Swatch({ color, label, on, onClick }: { color: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex min-h-16 min-w-36 items-center gap-3 rounded-xl border-2 px-3 py-2 text-[15px] ${on ? 'border-accent bg-panel-2 font-semibold' : 'border-line bg-panel font-medium'}`}
    >
      <span className="h-11 w-11 shrink-0 rounded-lg border border-line shadow-inner" style={{ background: color }} aria-hidden />
      {label}
    </button>
  );
}

export function LookSection() {
  const store = useHavenStore();
  const live = useLive();
  const apply = (r: EditResult) => {
    const s = store.getState();
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config);
  };
  return (
    <>
      <Section title="Fabric">
        <div role="radiogroup" aria-label="Fabric" className="flex flex-wrap gap-2" data-testid="fabrics">
          {FABRICS.map((f) => (
            <Swatch key={f.key} color={f.color} label={f.name} on={live.fabric === f.key} onClick={() => apply(setFabric(store.getState().config, f.key))} />
          ))}
        </div>
      </Section>
      <Section title="Wood">
        <div role="radiogroup" aria-label="Wood finish" className="flex flex-wrap gap-2" data-testid="finishes">
          {FINISHES.map((f) => (
            <Swatch key={f.key} color={f.color} label={f.name} on={live.tableFinish === f.key} onClick={() => apply(setTableFinish(store.getState().config, f.key))} />
          ))}
        </div>
      </Section>
    </>
  );
}
