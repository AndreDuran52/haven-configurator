// Mirror sides (UX Phase 3c fixes, Andre 2026-11-09, Q71): one switch under the
// side fields of a U. On, every change to one side is made to the other too;
// switched on with different sides, the left is copied to the right. Off until
// switched on, and off again when another layout opens. Lazy (with its action):
// out of the entry chunk.
import { useHaven, useHavenStore } from '@/state/store';
import { Switch } from './controls';
import { setMirrorSides } from './keepActions';

export default function MirrorSides() {
  const store = useHavenStore();
  const on = useHaven((s) => s.ui.mirror);
  return (
    <div className="flex flex-col" data-testid="mirror-sides">
      <Switch label="Mirror sides" checked={on} onChange={(v) => setMirrorSides(store, v)} />
      {on && <p className="text-sm text-ink-muted">A change to one side is made to the other too.</p>}
    </div>
  );
}
