// The Design tab (plan §10 H5; UX Phase 3; Andre 2026-11-09): the finish
// choices. Fabric; Tables (Wood top on fabric base | All wood) when the sofa
// has a table; Wood. All are in the share link. A later "Seats: Stitch line |
// No line" goes here too. The pillows and the plan style are in the View menu.
import { FABRICS, FINISHES, setFabric, setTableFinish, setTableStyle, type EditResult, type TableStyle } from '@/engine';
import { useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Section, Segmented } from './controls';

const TABLE_STYLES: { value: TableStyle; label: string }[] = [
  { value: 'standard', label: 'Wood top on fabric base' },
  { value: 'allWood', label: 'All wood' },
];

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
  const hasTable = useLiveLayout().sections.some((s) => Object.values(s.config.runs).some((ps) => ps?.some((p) => p.kind === 'table')));
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
      {hasTable && (
        <Section title="Tables">
          <Segmented label="Table style" value={live.tableStyle} options={TABLE_STYLES} onChange={(v) => apply(setTableStyle(store.getState().config, v))} />
        </Section>
      )}
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
