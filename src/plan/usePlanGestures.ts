// The plan's gesture engine (plan §8), ported from the prototype editor
// (docs/prototypes/planview/browser/editor.tsx):
// - one delegated handler on the root <svg>; pure hit-testing in plan inches;
// - pointer capture on the ROOT svg (grips are re-keyed when a split changes);
// - the CTM, k and viewBox are frozen for the gesture;
// - every frame runs op(startConfig, …) -> setDraft (never incremental: no drift);
// - pointerup flushes the last frame and commits once (= one undo step);
// - pointercancel / lostpointercapture cancel the draft (no trace).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  anchoredTargets,
  buildHaven,
  deletePiece,
  dragSeam,
  moveLoose,
  moveTable,
  reorderPiece,
  SNAP_HYSTERESIS,
  type BuildResult,
  type Config,
  type Placement,
  type Pt,
  type RunId,
} from '@/engine';
import { useHavenStore } from '@/state/store';
import { fmtIn } from './format';
import { hitTest, lineTolPx, type Grip } from './hitTest';
import { nearestTarget } from './placementTargets';
import { registerCancel } from './planScreen';
import type { PlanFitResult } from './planFit';

/** Tap: under 6 px and under 500 ms. Long-press (touch reorder): 350 ms. */
export const TAP_PX = 6;
export const TAP_MS = 500;
export const LONG_PRESS_MS = 350;
/** A table dropped farther than this from every target snaps back. */
const TABLE_SNAP_MAX = 60;

type Target = { placement: Placement; anchor: Pt };

type Gesture =
  | { kind: 'seam'; pointerId: number; run: RunId; seam: number; axis: 'x' | 'y'; start: Pt; startConfig: Config }
  | {
      kind: 'pending';
      pointerId: number;
      id: string;
      pieceKind: string;
      start: Pt;
      startClient: Pt;
      startConfig: Config;
      t0: number;
      touch: boolean;
      timer: number;
    }
  | { kind: 'table'; pointerId: number; id: string; startConfig: Config; targets: Target[]; current: Target | null; trash: boolean }
  | { kind: 'reorder'; pointerId: number; id: string; run: RunId; startConfig: Config }
  | { kind: 'loose'; pointerId: number; id: string; start: Pt; origin: Pt; startConfig: Config }
  | { kind: 'dead'; pointerId: number };

export interface Readout {
  x: number;
  y: number;
  text: string;
}

export type DragKind = 'seam' | 'table' | 'reorder' | 'loose' | null;

const isOver = (el: Element | null, x: number, y: number) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

/** The stored run index a pointer position corresponds to: piece centres before it (plan §8 "Reorder"). */
export function reorderIndex(c: Config, run: RunId, id: string, pt: Pt): number {
  const b = buildHaven(c);
  const r = b.runs.find((q) => q.id === run)!;
  const self = c.runs[run]!.findIndex((p) => p.id === id);
  const along = r.axis === 'x' ? pt[0] - r.origin[0] : pt[1] - r.origin[1];
  const centres = [
    ...b.pieces.filter((p) => p.run === run && p.index !== self).map((p) => p.offset! + p.length / 2),
    ...b.gaps.filter((g) => g.run === run && g.index !== self).map((g) => g.offset + g.length / 2),
  ];
  return centres.filter((x) => x < along).length;
}

const runOf = (c: Config, id: string): RunId | null =>
  (Object.keys(c.runs) as RunId[]).find((r) => c.runs[r]!.some((p) => p.id === id)) ?? null;

export function usePlanGestures({
  svgRef,
  built,
  fit,
  grips,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  built: BuildResult;
  fit: PlanFitResult | null;
  grips: Grip[];
}) {
  const store = useHavenStore();
  const gesture = useRef<Gesture | null>(null);
  const inv = useRef<DOMMatrix | null>(null);
  const raf = useRef(0);
  const latest = useRef<{ pt: Pt; client: Pt } | null>(null);
  const [frozen, setFrozen] = useState<PlanFitResult | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);

  const toPlan = (x: number, y: number, m: DOMMatrix): Pt => {
    const p = new DOMPoint(x, y).matrixTransform(m);
    return [p.x, p.y];
  };

  const runFrame = useCallback(() => {
    raf.current = 0;
    const g = gesture.current;
    const l = latest.current;
    if (!g || !l) return;
    const s = store.getState();
    const pill = (text: string) => setReadout({ x: l.client[0], y: l.client[1] - 72, text });
    if (g.kind === 'seam') {
      const along = g.axis === 'x' ? l.pt[0] - g.start[0] : l.pt[1] - g.start[1];
      const next = dragSeam(g.startConfig, g.run, g.seam, along).config;
      s.setDraft(next);
      const ps = next.runs[g.run]!;
      pill(`${fmtIn(ps[g.seam - 1]?.length ?? 0)} | ${fmtIn(ps[g.seam]?.length ?? 0)}`);
    } else if (g.kind === 'table') {
      g.trash = isOver(document.querySelector('[data-trash]'), l.client[0], l.client[1]);
      const inside = isOver(svgRef.current, l.client[0], l.client[1]);
      g.current = g.trash || !inside ? null : nearestTarget(g.targets, l.pt, g.current, SNAP_HYSTERESIS, TABLE_SNAP_MAX);
      const next = g.trash
        ? deletePiece(g.startConfig, g.id).config
        : g.current
          ? moveTable(g.startConfig, g.id, g.current.placement).config
          : g.startConfig;
      s.setDraft(next);
      pill(g.trash ? 'Remove table' : g.current ? 'Move table here' : 'Drop to cancel');
    } else if (g.kind === 'reorder') {
      const to = reorderIndex(g.startConfig, g.run, g.id, l.pt);
      const r = reorderPiece(g.startConfig, g.id, to);
      s.setDraft(r.config);
      pill(r.rejected ? "Can't go there" : 'Move here');
    } else if (g.kind === 'loose') {
      const next = moveLoose(g.startConfig, g.id, g.origin[0] + l.pt[0] - g.start[0], g.origin[1] + l.pt[1] - g.start[1]).config;
      s.setDraft(next);
    }
  }, [store, svgRef]);

  const promote = useCallback(
    (g: Extract<Gesture, { kind: 'pending' }>, to: 'table' | 'reorder' | 'loose' | 'dead') => {
      window.clearTimeout(g.timer);
      const base = { pointerId: g.pointerId, id: g.id, startConfig: g.startConfig };
      const run = runOf(g.startConfig, g.id);
      if (to === 'table') gesture.current = { kind: 'table', ...base, targets: anchoredTargets(g.startConfig, g.id), current: null, trash: false };
      else if (to === 'loose') {
        const lp = g.startConfig.loose.find((p) => p.id === g.id)!;
        gesture.current = { kind: 'loose', ...base, start: g.start, origin: [lp.x, lp.y] };
      } else if (to === 'reorder' && run) gesture.current = { kind: 'reorder', ...base, run };
      else gesture.current = { kind: 'dead', pointerId: g.pointerId };
      const k = gesture.current.kind;
      store.getState().setUi({ selectedId: null, dragging: k === 'dead' ? null : (k as DragKind) });
    },
    [store],
  );

  const end = useCallback(
    (commit: boolean) => {
      const g = gesture.current;
      if (!g) return;
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
        if (commit && g.kind !== 'pending' && g.kind !== 'dead') runFrame(); // flush the last position
      }
      gesture.current = null;
      latest.current = null;
      setReadout(null);
      setFrozen(null);
      const s = store.getState();
      s.setUi({ dragging: null });
      if (g.kind === 'pending') {
        window.clearTimeout(g.timer);
        if (commit) s.setUi({ selectedId: g.id, placing: null });
        return;
      }
      if (g.kind === 'dead') return;
      if (commit && g.kind === 'table' && !g.trash && !g.current) s.cancelDraft(); // dropped on nothing: snap back
      else if (commit) s.commit();
      else s.cancelDraft();
    },
    [runFrame, store],
  );

  // An unmount (view switch) mid-gesture leaves no draft behind.
  useEffect(() => () => {
    if (gesture.current) store.getState().cancelDraft();
  }, [store]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!fit || gesture.current || e.button > 0) return; // a second finger during a gesture is ignored
    const svg = svgRef.current!;
    const m = svg.getScreenCTM()!.inverse();
    const pt = toPlan(e.clientX, e.clientY, m);
    const s = store.getState();
    if (s.ui.placing) {
      // Tap-to-place: the pins handle their own taps; anywhere else cancels.
      if (!(e.target as Element).closest('[data-pin]')) s.setUi({ placing: null });
      return;
    }
    const hit = hitTest(built, grips, pt, { k: fit.k, lineTolPx: lineTolPx(e.pointerType) });
    if (!hit) {
      s.setUi({ selectedId: null });
      return;
    }
    inv.current = m;
    setFrozen(fit);
    svg.setPointerCapture(e.pointerId);
    const startConfig = s.config;
    if (hit.type === 'seam') {
      gesture.current = { kind: 'seam', pointerId: e.pointerId, run: hit.run, seam: hit.seam, axis: hit.axis, start: pt, startConfig };
      s.setUi({ selectedId: null, dragging: 'seam' });
      latest.current = { pt, client: [e.clientX, e.clientY] };
      runFrame();
      return;
    }
    const id = hit.type === 'piece' ? hit.id : startConfig.runs[hit.run]![hit.index]!.id;
    const pieceKind = hit.type === 'piece' ? hit.kind : 'gap';
    const touch = e.pointerType === 'touch';
    const g: Extract<Gesture, { kind: 'pending' }> = {
      kind: 'pending',
      pointerId: e.pointerId,
      id,
      pieceKind,
      start: pt,
      startClient: [e.clientX, e.clientY],
      startConfig,
      t0: e.timeStamp,
      touch,
      timer: 0,
    };
    // Touch reorders seats and gaps after a still long-press (plan §8).
    if (touch && (pieceKind === 'armless' || pieceKind === 'oneArm' || pieceKind === 'gap')) {
      g.timer = window.setTimeout(() => {
        if (gesture.current !== g) return;
        promote(g, 'reorder');
        setReadout({ x: g.startClient[0], y: g.startClient[1] - 72, text: 'Move' });
      }, LONG_PRESS_MS);
    }
    gesture.current = g;
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId || !inv.current) return;
    latest.current = { pt: toPlan(e.clientX, e.clientY, inv.current), client: [e.clientX, e.clientY] };
    if (g.kind === 'dead') return;
    if (g.kind === 'pending') {
      if (Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1]) <= TAP_PX) return;
      const k = g.pieceKind;
      if (k === 'table') promote(g, 'table');
      else if (k === 'ottoman' || k === 'coffeeTable') promote(g, 'loose');
      else if ((k === 'armless' || k === 'oneArm' || k === 'gap') && !g.touch) promote(g, 'reorder');
      else promote(g, 'dead'); // touch moved before the long-press, or a wedge
      if (gesture.current?.kind === 'dead') return;
    }
    if (!raf.current) raf.current = requestAnimationFrame(runFrame); // at most one engine run per frame
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.kind === 'pending' && e.timeStamp - g.t0 > TAP_MS) {
      window.clearTimeout(g.timer);
      gesture.current = { kind: 'dead', pointerId: g.pointerId };
    }
    end(true);
  };
  const onCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    if (gesture.current?.pointerId === e.pointerId) end(false);
  };

  /** Escape: cancel a running gesture (no trace). */
  const cancel = useCallback(() => {
    if (!gesture.current) return false;
    end(false);
    return true;
  }, [end]);
  useEffect(() => registerCancel(cancel), [cancel]);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onCancel, onLostPointerCapture: onCancel },
    frozen,
    readout,
    cancel,
  };
}
