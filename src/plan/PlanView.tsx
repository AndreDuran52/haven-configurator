// The on-screen plan: fits PlanDrawing to its container (plan §8 "Screen fit").
// H2 has no plan gestures, so the fit follows the live config (a measurement
// draft rescales as you type); H4 freezes k / viewBox during a gesture.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { builtOf, useHaven, useHavenStore, useLive } from '@/state/store';
import { planFit } from './planFit';
import { PlanDrawing } from './PlanDrawing';
import { LIGHT } from './theme';

export function PlanView() {
  const live = useLive();
  const selectedId = useHaven((s) => s.ui.selectedId);
  const built = builtOf(live);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrap.current!;
    // Whole pixels, floored: the 3D view uses the same box (parity hand-off).
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => (size.w > 40 && size.h > 40 ? planFit(built, size.w, size.h) : null), [built, size]);
  const store = useHavenStore();

  // Publish the drawn scale and centre for the Plan -> 3D hand-off (parity, plan §7.2).
  useEffect(() => {
    if (fit) store.getState().setUi({ planFit: { S: fit.S, cx: fit.cx, cy: fit.cy } });
  }, [fit, store]);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden" data-testid="plan-view">
      {fit && (
        <svg
          data-plan-svg=""
          data-k={fit.k}
          width={size.w}
          height={size.h}
          viewBox={`${fit.viewBox.x} ${fit.viewBox.y} ${fit.viewBox.w} ${fit.viewBox.h}`}
          className="plan-svg block"
          role="img"
          aria-label={`Plan: ${built.shape}, ${built.W} by ${Math.max(built.L, built.R)} inches, ${built.seats.label}`}
        >
          <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill={LIGHT.paper} />
          <PlanDrawing built={built} dims={fit.layout} k={fit.k} theme={LIGHT} showWarnings selectedId={selectedId} />
        </svg>
      )}
    </div>
  );
}
