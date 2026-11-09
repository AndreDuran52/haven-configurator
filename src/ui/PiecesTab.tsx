// The Pieces tab: what is it made of? (editor redesign, Andre 2026-11-06;
// Phase 3b; 2026-11-09): the add-piece tray (tap a chip then a + in the plan,
// or drag a chip into the plan; a tapped Table goes to the middle) and "When
// pieces change: Other seats adjust | Sofa size changes" (adding, deleting or
// resizing a piece, and arm width). Arm width is on the Size tab and the table
// style on the Design tab; a table's size controls belong here. Lazy: loads
// when the tab opens.
import { setLock } from '@/engine';
import { useHavenStore, useLive } from '@/state/store';
import { Section, Segmented } from './controls';
import { PieceTray } from './PieceTray';

export default function PiecesTab() {
  const store = useHavenStore();
  const live = useLive();
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
          onChange={(v) => {
            const s = store.getState();
            const r = setLock(s.config, v === 'keep');
            if (r.rejected) s.toast(r.rejected.message);
            else s.commit(r.config);
          }}
        />
        <p className="text-sm text-ink-muted" data-testid="lock-hint">
          {live.lockOutside ? 'Adding, removing or resizing a piece keeps the sofa’s size: the seats next to it adjust.' : 'Adding, removing or resizing a piece makes the sofa longer or shorter.'}
        </p>
      </Section>
    </>
  );
}
