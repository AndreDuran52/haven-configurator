// Load the 3D chunk after first paint (plan §7.5), so it is in the HTTP cache
// before the iPad leaves the shop's Wi-Fi. iOS Safari has NO requestIdleCallback
// (calling it would throw and blank the app), so it is feature-detected.
export const loadThreeView = () => import('@/three/ThreeView');

export const WARM_FALLBACK_MS = 1500;

type IdleWindow = Pick<Window, 'setTimeout' | 'clearTimeout' | 'requestAnimationFrame' | 'cancelAnimationFrame'> & {
  requestIdleCallback?: (cb: () => void) => number;
  cancelIdleCallback?: (id: number) => void;
  performance?: Pick<Performance, 'getEntriesByName'>;
  PerformanceObserver?: typeof PerformanceObserver;
};

const FCP = 'first-contentful-paint';

/** Runs `cb` once the first contentful paint has happened (two frames where paint timing is missing). */
function afterFirstPaint(win: IdleWindow, cb: () => void): () => void {
  if (win.performance?.getEntriesByName(FCP).length) {
    cb();
    return () => {};
  }
  const PO = win.PerformanceObserver;
  if (PO?.supportedEntryTypes?.includes('paint')) {
    const po = new PO((list) => {
      if (!list.getEntriesByName(FCP).length) return;
      po.disconnect();
      cb();
    });
    po.observe({ type: 'paint', buffered: true });
    return () => po.disconnect();
  }
  let id = 0;
  id = win.requestAnimationFrame(() => (id = win.requestAnimationFrame(cb)));
  return () => win.cancelAnimationFrame(id);
}

function whenIdle(win: IdleWindow, cb: () => void): () => void {
  if (typeof win.requestIdleCallback === 'function') {
    const id = win.requestIdleCallback(cb);
    return () => win.cancelIdleCallback?.(id);
  }
  const t = win.setTimeout(cb, WARM_FALLBACK_MS);
  return () => win.clearTimeout(t);
}

/** After first paint, when idle: load the 3D chunk. Returns the matching cancel. */
export function warm3d(win: IdleWindow, load: () => Promise<unknown> = loadThreeView): () => void {
  let cancelIdle = () => {};
  const cancelPaint = afterFirstPaint(win, () => {
    cancelIdle = whenIdle(win, () => void load().catch(() => {}));
  });
  return () => {
    cancelPaint();
    cancelIdle();
  };
}
