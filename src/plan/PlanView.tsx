// The on-screen plan editor (plan §8): fits PlanDrawing to its container and
// runs the gestures. The fit follows the live config (a measurement draft
// rescales as you type), except during a plan gesture: then k, the viewBox and
// the CTM stay frozen, so a lock-off drag never rescales under the finger.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { builtOf, useHaven, useHavenStore, useLive } from '@/state/store';
import { fitScreen } from './dimLayout';
import { gripPoints } from './hitTest';
import { ClearanceLayer } from './ClearanceLayer';
import { GripsLayer } from './GripsLayer';
import { PLAN_PAD_PX, planFit } from './planFit';
import { PlacementPins } from './PlacementPins';
import { PlanDrawing } from './PlanDrawing';
import { installPlanTestApi, registerPlanSvg } from './planScreen';
import { LIGHT } from './theme';
import { usePlanGestures } from './usePlanGestures';

export function PlanView() {
  const live = useLive();
  const selectedId = useHaven((s) => s.ui.selectedId);
  const placing = useHaven((s) => s.ui.placing);
  const dragging = useHaven((s) => s.ui.dragging);
  const built = builtOf(live);
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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
  const store = useHavenStore();
  useEffect(() => registerPlanSvg(svgRef), []);
  useEffect(() => installPlanTestApi(() => store.getState().config), [store]);

  const liveFit = useMemo(() => (size.w > 40 && size.h > 40 ? planFit(built, size.w, size.h) : null), [built, size]);
  const liveGrips = useMemo(() => (liveFit ? gripPoints(built, liveFit.k) : []), [built, liveFit]);
  const g = usePlanGestures({ svgRef, built, fit: liveFit, grips: liveGrips });
  const fit = g.frozen ?? liveFit;
  // During a gesture: frozen k / viewBox, live dimensions (the same k while the lock is on).
  const dims = useMemo(
    () => (g.frozen ? fitScreen(built, size.w, size.h, PLAN_PAD_PX).layout : (liveFit?.layout ?? null)),
    [g.frozen, built, size, liveFit],
  );
  const grips = useMemo(() => (g.frozen ? gripPoints(built, g.frozen.k) : liveGrips), [g.frozen, built, liveGrips]);

  // Publish the drawn scale and centre for the Plan -> 3D hand-off (parity, plan §7.2).
  useEffect(() => {
    if (liveFit && !g.frozen) store.getState().setUi({ planFit: { S: liveFit.S, cx: liveFit.cx, cy: liveFit.cy } });
  }, [liveFit, g.frozen, store]);

  const coffee = built.pieces.filter((p) => p.kind === 'coffeeTable' && (p.id === selectedId || dragging === 'loose'));

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden" data-testid="plan-view">
      {fit && (
        <svg
          ref={svgRef}
          data-plan-svg=""
          data-k={fit.k}
          width={size.w}
          height={size.h}
          viewBox={`${fit.viewBox.x} ${fit.viewBox.y} ${fit.viewBox.w} ${fit.viewBox.h}`}
          className="plan-svg block"
          role="application"
          aria-label={`Plan: ${built.shape}, ${built.W} by ${Math.max(built.L, built.R)} inches, ${built.seats.label}`}
          {...g.handlers}
        >
          <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill={LIGHT.paper} />
          <PlanDrawing built={built} dims={dims} k={fit.k} theme={LIGHT} showWarnings selectedId={selectedId} />
          {coffee.map((p) => (
            <ClearanceLayer key={p.id} built={built} id={p.id} k={fit.k} />
          ))}
          {placing && <PlacementPins kind={placing} k={fit.k} />}
          {!placing && <GripsLayer grips={grips} built={built} k={fit.k} />}
        </svg>
      )}
      {g.readout && (
        <div
          data-readout=""
          className="pointer-events-none fixed z-30 -translate-x-1/2 rounded-lg bg-[#1c1b19] px-2.5 py-1.5 text-[15px] font-semibold whitespace-nowrap text-white tabular-nums shadow"
          style={{ left: g.readout.x, top: g.readout.y }}
        >
          {g.readout.text}
        </div>
      )}
    </div>
  );
}
