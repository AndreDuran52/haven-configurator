// The on-screen plan: fits PlanDrawing to its container (plan §8 "Screen fit").
// H2 has no plan gestures, so the fit follows the live config (a measurement
// draft rescales as you type); H4 freezes k / viewBox during a gesture.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { builtOf, useHaven, useLive } from '@/state/store';
import { fitScreen } from './dimLayout';
import { PlanDrawing } from './PlanDrawing';
import { LIGHT } from './theme';

const PAD_PX = 12;

export function PlanView() {
  const live = useLive();
  const selectedId = useHaven((s) => s.ui.selectedId);
  const built = builtOf(live);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrap.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => (size.w > 40 && size.h > 40 ? fitScreen(built, size.w, size.h, PAD_PX) : null), [built, size]);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden" data-testid="plan-view">
      {fit && (
        <svg
          data-plan-svg=""
          data-k={fit.k}
          width={size.w}
          height={size.h}
          viewBox={viewBox(fit.layout.bounds, PAD_PX * fit.k)}
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

const viewBox = (b: { x: number; y: number; w: number; h: number }, pad: number) =>
  `${b.x - pad} ${b.y - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}`;
