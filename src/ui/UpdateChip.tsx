// "Update available · Reload" (plan §3): the service worker never reloads on
// its own, because that would wipe an edit in front of a client. With unsaved
// changes the first tap only asks (UX Phase 1); the layout and the open project
// survive a reload either way, but the undo history does not.
import { useState, useSyncExternalStore } from 'react';
import { pendingUpdate, subscribeUpdate } from '@/state/update';
import { isDirty, useHavenStore } from '@/state/store';

export function UpdateChip() {
  const store = useHavenStore();
  const apply = useSyncExternalStore(subscribeUpdate, pendingUpdate);
  const [asked, setAsked] = useState(false);
  if (!apply) return null;
  const tap = () => {
    if (!asked && isDirty(store.getState())) return setAsked(true);
    apply();
  };
  return (
    <button
      type="button"
      data-testid="update-chip"
      onClick={tap}
      className="fixed top-[calc(4rem+env(safe-area-inset-top))] left-1/2 z-30 min-h-11 -translate-x-1/2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent shadow-lg"
    >
      {asked ? 'Unsaved changes. Save first, or tap again to reload' : 'Update available · Reload'}
    </button>
  );
}
