// The on-screen plan editor (plan §8): fits PlanDrawing to its container and
// runs the gestures. A layout of joined sections (a T) draws every section at
// its place, with one set of world dimensions; the edited section takes the
// gestures in its own inches, and a tap on another section starts editing it. The fit follows the live config (a slider or stepper draft
// rescales as you type), except during a plan gesture: then k, the viewBox and
// the CTM stay frozen, so a lock-off drag never rescales under the finger.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Pt } from '@/engine';
import { layoutBuiltOf, useHaven, useHavenStore, useLiveLayout } from '@/state/store';
import { fitSource } from './dimLayout';
import { DimsLayer } from './DimsLayer';
import { gripPoints, hitTest, inPoly, lineTolPx } from './hitTest';
import { layoutDimSource, layoutSeatsAt } from './layoutDims';
import { ClearanceLayer } from './ClearanceLayer';
import { GripsLayer } from './GripsLayer';
import { PLAN_PAD_PX, planFitSource } from './planFit';
import { PlacementPins } from './PlacementPins';
import { PlanDrawing } from './PlanDrawing';
import { installPlanTestApi, registerPlanSvg, setPlanOffset } from './planScreen';
import { LIGHT, SKETCH } from './theme';
import { usePlanGestures } from './usePlanGestures';

export function PlanView() {
  const lb = layoutBuiltOf(useLiveLayout());
  const section = useHaven((s) => s.ui.section);
  const active = lb.sections.find((x) => x.id === section) ?? lb.sections[0]!;
  const offset: Pt = active.offset;
  setPlanOffset(offset);
  const selectedId = useHaven((s) => s.ui.selectedId);
  const placing = useHaven((s) => s.ui.placing);
  const dragging = useHaven((s) => s.ui.dragging);
  const readOnly = useHaven((s) => s.ui.readOnly);
  const theme = useHaven((s) => (s.ui.look === 'sketch' ? SKETCH : LIGHT));
  const built = active.built;
  const src = useMemo(() => layoutDimSource(lb), [lb]);
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
  useEffect(() => installPlanTestApi(() => store.getState().config, () => store.getState().layout), [store]);

  const liveFit = useMemo(() => (size.w > 40 && size.h > 40 ? planFitSource(src, size.w, size.h) : null), [src, size]);
  const liveGrips = useMemo(() => (liveFit ? gripPoints(built, liveFit.k) : []), [built, liveFit]);
  const g = usePlanGestures({ svgRef, built, fit: liveFit, grips: liveGrips, offset });
  const fit = g.frozen ?? liveFit;
  // During a gesture: frozen k / viewBox, live dimensions (the same k while the lock is on).
  const dims = useMemo(
    () => (g.frozen ? fitSource(src, size.w, size.h, PLAN_PAD_PX).layout : (liveFit?.layout ?? null)),
    [g.frozen, src, size, liveFit],
  );
  const grips = useMemo(() => (g.frozen ? gripPoints(built, g.frozen.k) : liveGrips), [g.frozen, built, liveGrips]);

  // Publish the drawn scale and centre for the Plan -> 3D hand-off (parity, plan §7.2).
  useEffect(() => {
    if (liveFit && !g.frozen) store.getState().setUi({ planFit: { S: liveFit.S, cx: liveFit.cx, cy: liveFit.cy } });
  }, [liveFit, g.frozen, store]);

  const coffee = built.pieces.filter((p) => p.kind === 'coffeeTable' && (p.id === selectedId || dragging === 'loose'));

  // A layout: a tap that misses the edited section but lands on another one starts editing that one.
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!lb.solo && fit && !store.getState().ui.placing) {
      const m = svgRef.current?.getScreenCTM()?.inverse();
      const p = m && new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
      if (p) {
        const local: Pt = [p.x - offset[0], p.y - offset[1]];
        if (!hitTest(built, grips, local, { k: fit.k, lineTolPx: lineTolPx(e.pointerType) })) {
          for (const s of lb.sections) {
            if (s.id === active.id) continue;
            const q: Pt = [p.x - s.offset[0], p.y - s.offset[1]];
            const hit = s.built.pieces.find((pc) => inPoly(q, pc.polygon));
            if (hit) {
              store.getState().setSection(s.id);
              store.getState().setUi({ selectedId: hit.id, placing: null });
              return;
            }
          }
        }
      }
    }
    g.handlers.onPointerDown(e);
  };

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden" data-testid="plan-view">
      {fit && (
        <svg
          ref={svgRef}
          data-plan-svg=""
          data-k={fit.k}
          data-look={theme === SKETCH ? 'sketch' : 'cad'}
          width={size.w}
          height={size.h}
          viewBox={`${fit.viewBox.x} ${fit.viewBox.y} ${fit.viewBox.w} ${fit.viewBox.h}`}
          className="plan-svg block"
          role="application"
          aria-label={
            lb.solo
              ? `Plan: ${built.shape}, ${built.W} by ${Math.max(built.L, built.R)} inches, ${built.seats.label}`
              : `Plan: T shape, ${lb.overall.W} by ${lb.overall.depth} inches, ${lb.seats.label}`
          }
          {...(readOnly ? {} : { ...g.handlers, onPointerDown })}
        >
          <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill={theme.paper} />
          {lb.solo ? (
            <PlanDrawing built={built} dims={dims} k={fit.k} theme={theme} showWarnings selectedId={selectedId} />
          ) : (
            <>
              {/* The root last: with a shared back it owns the frame down the stem. */}
              {[...lb.sections].reverse().map((s) => (
                <g key={s.id} data-section={s.id} data-active={s.id === active.id ? '' : undefined} transform={`translate(${s.offset[0]} ${s.offset[1]})`}>
                  <PlanDrawing built={s.built} dims={null} k={fit.k} theme={theme} showWarnings selectedId={s.id === active.id ? selectedId : null} showSeats={false} />
                </g>
              ))}
              {dims && <DimsLayer dims={dims} theme={theme} />}
              <g data-seats="">
                <text x={layoutSeatsAt(lb)[0]} y={layoutSeatsAt(lb)[1]} fontSize={+(16 * fit.k).toFixed(4)} fontFamily={theme.font} fontWeight={theme.bold} fill={theme.ink} textAnchor="middle">
                  {lb.seats.label}
                </text>
              </g>
            </>
          )}
          <g transform={lb.solo ? undefined : `translate(${offset[0]} ${offset[1]})`}>
            {coffee.map((p) => (
              <ClearanceLayer key={p.id} built={built} id={p.id} k={fit.k} />
            ))}
            {placing && <PlacementPins kind={placing} k={fit.k} />}
            {!placing && !readOnly && <GripsLayer grips={grips} built={built} k={fit.k} />}
          </g>
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
