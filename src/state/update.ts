// The service worker's "update available" signal (plan §3), outside React so
// main.tsx can raise it and UpdateChip can read it.
let reload: (() => void) | null = null;
const listeners = new Set<() => void>();

/** Called by main.tsx's registerSW onNeedRefresh. */
export function offerUpdate(apply: () => void): void {
  reload = apply;
  for (const l of listeners) l();
}

export const subscribeUpdate = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const pendingUpdate = (): (() => void) | null => reload;
