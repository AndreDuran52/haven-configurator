// Add-piece tray (plan §8): Armless 36, One-arm L/R, Table 32, Ottoman, Coffee
// table. Tap to place (primary on iPad): "+" pins appear at every valid target.
// Or drag a chip into the plan (through the plan's CTM): the nearest target
// previews as a draft and the drop commits it (one undo step). During a table
// drag the tray becomes the trash. Hidden on phones (view and share first,
// plan §8): the plan keeps its height there; the tap menu still edits.
import { useRef, useState } from 'react';
import { addLoose, LOOSE_DEFAULTS, SNAP_HYSTERESIS, type Config } from '@/engine';
import { clientToPlan, planSvg } from '@/plan/planScreen';
import { isLooseTray, nearestTarget, placementTargets, type PlacementTarget, type TrayKind } from '@/plan/placementTargets';
import { useHaven, useHavenStore } from '@/state/store';

const ITEMS: { kind: TrayKind; label: string }[] = [
  { kind: 'armless', label: 'Armless 36″' },
  { kind: 'oneArmL', label: 'One-arm L' },
  { kind: 'oneArmR', label: 'One-arm R' },
  { kind: 'table', label: 'Table 32″' },
  { kind: 'ottoman', label: 'Ottoman' },
  { kind: 'coffeeTable', label: 'Coffee table' },
];

const DRAG_PX = 6;
const TRAY_SNAP_MAX = 60;

type TrayDrag = {
  kind: TrayKind;
  pointerId: number;
  start: [number, number];
  started: boolean;
  startConfig: Config;
  targets: PlacementTarget[];
  current: PlacementTarget | null;
  loose: Config | null;
};

/** A loose piece dropped at plan point `pt` (its centre under the finger). */
function looseAt(c: Config, kind: 'ottoman' | 'coffeeTable', pt: [number, number]): Config {
  const { w, d } = LOOSE_DEFAULTS[kind];
  return addLoose(c, kind, { x: pt[0] - w / 2, y: pt[1] - d / 2 }).config;
}

export function PieceTray() {
  const store = useHavenStore();
  const placing = useHaven((s) => s.ui.placing);
  const dragging = useHaven((s) => s.ui.dragging);
  const drag = useRef<TrayDrag | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);

  const tap = (kind: TrayKind) => {
    const s = store.getState();
    s.setView('plan'); // pieces are placed in the plan (a tap in 3D goes back to it)
    if (isLooseTray(kind)) {
      const r = addLoose(s.config, kind);
      if (r.rejected) return s.toast(r.rejected.message);
      s.commit(r.config);
      s.setUi({ placing: null, selectedId: r.config.loose[r.config.loose.length - 1]!.id });
      return;
    }
    const next = placing === kind ? null : kind;
    if (next && placementTargets(s.config, next).length === 0) return s.toast('No room for that piece. Make a run longer or remove a piece first.');
    s.setUi({ placing: next, selectedId: null });
  };

  const onPointerDown = (kind: TrayKind) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (drag.current || e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      kind,
      pointerId: e.pointerId,
      start: [e.clientX, e.clientY],
      started: false,
      startConfig: store.getState().config,
      targets: [],
      current: null,
      loose: null,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.start[0], e.clientY - d.start[1]) <= DRAG_PX) return;
      d.started = true;
      d.targets = isLooseTray(d.kind) ? [] : placementTargets(d.startConfig, d.kind);
      store.getState().setUi({ dragging: 'tray', placing: null, selectedId: null });
    }
    const label = ITEMS.find((i) => i.kind === d.kind)!.label;
    setGhost({ x: e.clientX, y: e.clientY, label });
    const svg = planSvg();
    const r = svg?.getBoundingClientRect();
    const inside = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    const pt = inside ? clientToPlan(e.clientX, e.clientY) : null;
    const s = store.getState();
    if (!pt) {
      d.current = null;
      d.loose = null;
      s.cancelDraft();
      return;
    }
    if (isLooseTray(d.kind)) {
      d.loose = looseAt(d.startConfig, d.kind, pt);
      s.setDraft(d.loose);
      return;
    }
    d.current = nearestTarget(d.targets, pt, d.current, SNAP_HYSTERESIS, TRAY_SNAP_MAX);
    if (d.current) s.setDraft(d.current.config);
    else s.cancelDraft();
  };

  const finish = (commit: boolean) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setGhost(null);
    const s = store.getState();
    if (!d.started) {
      if (commit) tap(d.kind);
      return;
    }
    s.setUi({ dragging: null });
    const result = d.current?.config ?? d.loose;
    if (commit && result) {
      s.commit(result);
      if (d.loose) s.setUi({ selectedId: result.loose[result.loose.length - 1]!.id });
    } else s.cancelDraft();
  };

  if (dragging === 'table') {
    return (
      <div
        data-trash=""
        className="hidden min-h-12 items-center justify-center rounded-lg border-2 border-dashed border-danger text-sm font-semibold text-danger min-[600px]:flex"
      >
        Drop here to remove the table
      </div>
    );
  }

  return (
    <div className="tray-row hidden min-w-0 items-center gap-2 min-[600px]:flex" role="toolbar" aria-label="Add a piece" data-tray="">
      <span className="shrink-0 text-xs font-semibold tracking-wide text-ink-muted uppercase">Add</span>
      {ITEMS.map((it) => (
        <button
          key={it.kind}
          type="button"
          data-tray-item={it.kind}
          aria-pressed={placing === it.kind}
          onPointerDown={onPointerDown(it.kind)}
          onPointerMove={onPointerMove}
          onPointerUp={finish(true)}
          onPointerCancel={finish(false)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tap(it.kind))}
          className={`tray-chip min-h-11 shrink-0 rounded-lg border px-3 text-sm font-medium whitespace-nowrap select-none ${
            placing === it.kind ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-ink'
          }`}
        >
          {it.label}
        </button>
      ))}
      {placing && <span className="shrink-0 text-xs text-ink-muted">Tap a + in the plan</span>}
      {ghost && (
        <div
          className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-[130%] rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.label}
        </div>
      )}
    </div>
  );
}
