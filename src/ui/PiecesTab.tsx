// The Pieces tab (editor redesign, Andre 2026-11-06): the add-piece tray
// (moved here from under the plan; tap a chip then a + in the plan, or drag a
// chip into the plan) and the table style. Lazy: loads when the tab opens.
import { setTableStyle, type TableStyle } from '@/engine';
import { useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Section, Segmented } from './controls';
import { PieceTray } from './PieceTray';

const TABLE_STYLES: { value: TableStyle; label: string }[] = [
  { value: 'standard', label: 'Wood top' },
  { value: 'allWood', label: 'All wood' },
];

export default function PiecesTab() {
  const store = useHavenStore();
  const live = useLive();
  const hasTable = useLiveLayout().sections.some((s) => Object.values(s.config.runs).some((ps) => ps?.some((p) => p.kind === 'table')));
  return (
    <>
      <Section title="Add a piece">
        <PieceTray />
      </Section>
      {hasTable && (
        <Section title="Tables">
          <Segmented
            label="Table style"
            value={live.tableStyle}
            options={TABLE_STYLES}
            onChange={(v) => {
              const s = store.getState();
              const r = setTableStyle(s.config, v);
              if (r.rejected) s.toast(r.rejected.message);
              else s.commit(r.config);
            }}
          />
          <p className="text-xs text-ink-muted">{live.tableStyle === 'standard' ? '2″ wood top on a fabric base' : 'Solid wood, top to floor'}</p>
        </Section>
      )}
    </>
  );
}
