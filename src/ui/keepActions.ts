// UX Phase 3c actions that load on first use (they keep the shape conversion
// and the side copy out of the entry chunk): switch the shape in place, and
// Copy left to right / right to left. Each is one commit, one undo step.
import type { Shape } from '@/engine';
import { setLayoutShape } from '@/engine/shapeLayout';
import { copySide, sidesMatch } from '@/engine/sides';
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

/** A mirror copy of one side of a U onto the other. */
export function copySideOf(store: HavenStore, from: 'left' | 'right'): void {
  const s = store.getState();
  if (sidesMatch(s.config)) return s.toast('The two sides are already the same');
  const r = copySide(s.config, from);
  if (r.rejected) return s.toast(r.rejected.message);
  s.commit(r.config, { say: from === 'left' ? 'Copied the left side to the right' : 'Copied the right side to the left' });
}
