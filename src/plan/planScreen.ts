// The live plan <svg>, for things outside it that need its coordinates: a tray
// drag (client -> plan inches through the CTM) and Escape (cancel a gesture).
import { anchoredTargets, buildHaven, encode, type Config, type Pt } from '@/engine';

let svg: React.RefObject<SVGSVGElement | null> | null = null;
let cancelGesture: (() => boolean) | null = null;

export function registerPlanSvg(ref: React.RefObject<SVGSVGElement | null>) {
  svg = ref;
  return () => {
    if (svg === ref) svg = null;
  };
}

export function registerCancel(fn: () => boolean) {
  cancelGesture = fn;
  return () => {
    if (cancelGesture === fn) cancelGesture = null;
  };
}

/** Cancel a running plan gesture; true if there was one. */
export const cancelPlanGesture = () => cancelGesture?.() ?? false;

export const planSvg = (): SVGSVGElement | null => svg?.current ?? null;

/** Client px -> plan inches, or null when the plan isn't on screen. */
export function clientToPlan(x: number, y: number): Pt | null {
  const el = planSvg();
  const m = el?.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(x, y).matrixTransform(m.inverse());
  return [p.x, p.y];
}

/** Plan inches -> client px. */
export function planToClient(x: number, y: number): Pt | null {
  const m = planSvg()?.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(x, y).matrixTransform(m);
  return [p.x, p.y];
}

/** Plan inches per CSS px on screen. */
export function planK(): number | null {
  const k = Number(planSvg()?.dataset.k);
  return Number.isFinite(k) && k > 0 ? k : null;
}

/**
 * `window.__plan` for the e2e scripts (like `window.__haven`): plan <-> client
 * coordinates, table-drag anchors and the share code, all read from the app.
 */
export function installPlanTestApi(get: () => Config) {
  const w = window as unknown as { __plan?: unknown };
  w.__plan = {
    toClient: (x: number, y: number) => planToClient(x, y),
    k: () => planK(),
    anchors: (id: string) => anchoredTargets(get(), id).map((t) => ({ placement: t.placement, client: planToClient(...t.anchor) })),
    encode: () => encode(get()),
    exportBlocked: () => buildHaven(get()).exportBlocked,
  };
}
