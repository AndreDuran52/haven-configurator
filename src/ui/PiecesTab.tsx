// The Pieces tab: what is it made of? (editor redesign, Andre 2026-11-06;
// Phase 3b, 2026-11-08): the add-piece tray (tap a chip then a + in the plan,
// or drag a chip into the plan), "When pieces change: Other seats adjust |
// Sofa size changes" (adding, deleting or resizing a piece, and arm width),
// the table style and the arm width (hold ± to repeat). Lazy: loads when the
// tab opens.
import { ARM_MAX, ARM_MIN, setArmWidth, setLock, setTableStyle, type EditResult, type TableStyle } from '@/engine';
import { useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Section, Segmented } from './controls';
import { PieceTray } from './PieceTray';
import { Stepper } from './Stepper';

const TABLE_STYLES: { value: TableStyle; label: string }[] = [
  { value: 'standard', label: 'Wood top' },
  { value: 'allWood', label: 'All wood' },
];

export default function PiecesTab() {
  const store = useHavenStore();
  const live = useLive();
  const hasTable = useLiveLayout().sections.some((s) => Object.values(s.config.runs).some((ps) => ps?.some((p) => p.kind === 'table')));
  /** Commit an op on the committed config; false when refused (a hold stops there). */
  const commit = (r: EditResult, key?: string) => {
    const s = store.getState();
    if (r.rejected) {
      s.toast(r.rejected.message);
      return false;
    }
    s.commit(r.config, key ? { key } : undefined);
  };
  const arm = (d: number) => {
    const c = store.getState().config;
    const a = c.dims.A + d;
    if (a < ARM_MIN || a > ARM_MAX) return false;
    return commit(setArmWidth(c, a), 'armWidth');
  };
  return (
    <>
      <Section title="Add a piece">
        <PieceTray />
      </Section>
      <Section title="When pieces change">
        <Segmented
          label="When pieces change"
          value={live.lockOutside ? 'keep' : 'grow'}
          options={[
            { value: 'keep', label: 'Other seats adjust' },
            { value: 'grow', label: 'Sofa size changes' },
          ]}
          onChange={(v) => commit(setLock(store.getState().config, v === 'keep'))}
        />
        <p className="text-sm text-ink-muted" data-testid="lock-hint">
          {live.lockOutside ? 'Adding, removing or resizing a piece keeps the sofa’s size: the seats next to it adjust.' : 'Adding, removing or resizing a piece makes the sofa longer or shorter.'}
        </p>
      </Section>
      {hasTable && (
        <Section title="Tables">
          <Segmented
            label="Table style"
            value={live.tableStyle}
            options={TABLE_STYLES}
            onChange={(v) => commit(setTableStyle(store.getState().config, v))}
          />
          <p className="text-sm text-ink-muted">{live.tableStyle === 'standard' ? 'Wood top on a fabric base' : 'Solid wood, top to floor'}</p>
        </Section>
      )}
      <Section title="Arm width">
        <div className="flex items-center gap-2">
          <Stepper label="Arm width minus ½" disabled={live.dims.A <= ARM_MIN} onStep={() => arm(-0.5)}>
            −
          </Stepper>
          <span className="flex-1 text-center text-[15px] tabular-nums" data-testid="arm-width">
            {live.dims.A}″ arms
          </span>
          <Stepper label="Arm width plus ½" disabled={live.dims.A >= ARM_MAX} onStep={() => arm(0.5)}>
            +
          </Stepper>
        </div>
      </Section>
    </>
  );
}
