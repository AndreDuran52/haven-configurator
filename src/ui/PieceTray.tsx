// Add-piece tray (plan §8): Armless 36, One-arm L/R, Table (20 in a seat, 32 at a seam), Ottoman, Coffee
// table. Tap to place (primary on iPad): "+" pins appear at every valid target.
// Or drag a chip into the plan (through the plan's CTM): the nearest target
// previews as a draft and the drop commits it (one undo step). Since the editor
// redesign (2026-11-06) it lives in the Pieces tab, each chip with a grip, and
// the trash for a table drag is a bar over the plan (TrashBar).
import { useRef, useState } from 'react';
import { addLooseInLayout, LOOSE_DEFAULTS, rootConfig, SNAP_HYSTERESIS, type Config, type Layout } from '@/engine';
import { clientToLocal, planOffset, planSvg } from '@/plan/planScreen';
import { isLooseTray, nearestTarget, placementTargets, type PlacementTarget, type TrayKind } from '@/plan/placementTargets';
import { useHaven, useHavenStore } from '@/state/store';

const ITEMS: { kind: TrayKind; label: string }[] = [
  { kind: 'armless', label: 'Armless 36″' },
  { kind: 'oneArmL', label: 'One-arm L' },
  { kind: 'oneArmR', label: 'One-arm R' },
  { kind: 'table', label: 'Table' },
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
  startLayout: Layout;
  section: string;
  targets: PlacementTarget[];
  current: PlacementTarget | null;
  loose: Layout | null;
};

/**
 * A loose piece dropped at plan point `pt` of the edited section (its centre
 * under the finger). Loose pieces live in the root (world inches), so a T's
 * right half adds its offset (QA 2026-11-06: they were refused there).
 */
function looseAt(l: Layout, section: string, kind: 'ottoman' | 'coffeeTable', pt: [number, number]): Layout {
  const { w, d } = LOOSE_DEFAULTS[kind];
  const [ox, oy] = planOffset();
  return addLooseInLayout(l, section, kind, { x: pt[0] + ox - w / 2, y: pt[1] + oy - d / 2 }).layout;
}

/** The newest loose piece of a layout (it lives in the root). */
const newestLoose = (l: Layout) => rootConfig(l).loose[rootConfig(l).loose.length - 1]!.id;

/** Six dots: this chip can be dragged. */
function Grip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden className="shrink-0 opacity-60">
      {[3, 8, 13].flatMap((y) => [2, 8].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.5} fill="currentColor" />))}
    </svg>
  );
}

export function PieceTray() {
  const store = useHavenStore();
  const placing = useHaven((s) => s.ui.placing);
  const drag = useRef<TrayDrag | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);

  const tap = (kind: TrayKind) => {
    const s = store.getState();
    s.setView('plan'); // pieces are placed in the plan (a tap in 3D goes back to it)
    if (isLooseTray(kind)) {
      const r = addLooseInLayout(s.layout, s.ui.section, kind);
      if (r.rejected) return s.toast(r.rejected.message);
      s.commitLayout(r.layout);
      // The new piece is the root's: edit it there (a T's left half).
      s.setSection(r.layout.sections[0]!.id);
      s.setUi({ placing: null, selectedId: newestLoose(r.layout) });
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
      startLayout: store.getState().layout,
      section: store.getState().ui.section,
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
    const pt = inside ? clientToLocal(e.clientX, e.clientY) : null;
    const s = store.getState();
    if (!pt) {
      d.current = null;
      d.loose = null;
      s.cancelDraft();
      return;
    }
    if (isLooseTray(d.kind)) {
      d.loose = looseAt(d.startLayout, d.section, d.kind, pt);
      s.setLayoutDraft(d.loose);
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
    if (commit && d.loose) {
      s.commitLayout(d.loose);
      s.setSection(d.loose.sections[0]!.id);
      s.setUi({ selectedId: newestLoose(d.loose) });
    } else if (commit && d.current) s.commit(d.current.config);
    else s.cancelDraft();
  };

  return (
    <div className="tray-grid grid min-w-0 grid-cols-2 gap-2" role="toolbar" aria-label="Add a piece" data-tray="">
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
          className={`tray-chip flex min-h-12 items-center gap-2 rounded-lg border px-2.5 text-left text-sm font-medium whitespace-nowrap select-none ${
            placing === it.kind ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-ink'
          }`}
        >
          <Grip />
          {it.label}
        </button>
      ))}
      {placing && <p className="col-span-2 text-sm text-ink-muted">Tap a + in the plan</p>}
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
