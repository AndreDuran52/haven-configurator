import { useEffect, useState } from 'react';
import { useHaven } from '@/state/store';

export const TOAST_MS = 3500;

/** A short message above the bottom bar (refusals, loads, damaged links). */
export function Toast() {
  const toast = useHaven((s) => s.ui.toast);
  const [hiddenAt, setHiddenAt] = useState(0);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setHiddenAt(toast.at), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast || toast.at === hiddenAt) return null;
  return (
    <div role="status" data-testid="toast" className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
      <p className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas shadow-lg">{toast.text}</p>
    </div>
  );
}
