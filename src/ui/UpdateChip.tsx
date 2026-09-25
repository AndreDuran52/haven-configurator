// "Update available · Reload" (plan §3): the service worker never reloads on
// its own, because that would wipe an edit in front of a client.
import { useSyncExternalStore } from 'react';
import { pendingUpdate, subscribeUpdate } from '@/state/update';

export function UpdateChip() {
  const apply = useSyncExternalStore(subscribeUpdate, pendingUpdate);
  if (!apply) return null;
  return (
    <button
      type="button"
      data-testid="update-chip"
      onClick={apply}
      className="fixed top-[calc(4rem+env(safe-area-inset-top))] left-1/2 z-30 min-h-11 -translate-x-1/2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent shadow-lg"
    >
      Update available · Reload
    </button>
  );
}
