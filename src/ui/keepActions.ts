// UX Phase 3c actions that load on first use (they keep the shape conversion
// and the side copy out of the entry chunk): switch the shape in place, and
// the Mirror sides switch (Andre 2026-11-09, Q71). Each is one commit, one undo step.
import type { Shape } from '@/engine';
import { setLayoutShape } from '@/engine/shapeLayout';
import { copySide, mirrorSides, sidesMatch } from '@/engine/sides';
import type { StartChoice } from '@/state/start';
import type { HavenStore } from '@/state/store';

/** The shape converts in place: every seat and table stays; Reset then returns to that shape's standard sofa. */
export function convertShape(store: HavenStore, v: Shape, lastStart: StartChoice): void {
  const s = store.getState();
  const r = setLayoutShape(s.layout, v);
  if (r.rejected) return s.toast(r.rejected.message);
  s.commitLayout(r.layout);
  s.setUi({ lastStart, selectedId: null });
}

/**
 * Mirror sides on or off. Switched on with different sides, the left is copied
 * to the right (one undo step; the result line says so). While on, the store
 * makes every edit to one side on the other too.
 */
export function setMirrorSides(store: HavenStore, on: boolean): void {
  const s = store.getState();
  if (!on) return s.setMirror(null);
  s.setMirror(mirrorSides);
  if (sidesMatch(s.config)) return;
  const r = copySide(s.config, 'left');
  if (r.rejected) {
    s.setMirror(null);
    return s.toast(r.rejected.message);
  }
  s.commit(r.config, { say: 'Left side copied to the right' });
}
