// The shape picker on top of the side panel (editor redesign, Andre
// 2026-11-06): U · L left · L right · Straight. UX Phase 3c (Andre,
// 2026-11-09, "keep my work"): picking a shape converts the sofa in place, with
// no prompt: every seat and table stays and the width changes by the corner
// (U -> L drops a leg and that end gets an arm; L -> U copies the leg;
// Straight -> L or U adds corners and standard legs). The room and Snug stay;
// the result line says what changed and one Undo brings it back. Reset then
// returns to that shape's standard sofa. The T is custom work (hidden
// 2026-11-06): an opened T shows "T" here, and picking a shape starts it fresh
// (asking first when the T was edited: ShapeGuard).
import { lazy, Suspense, useState } from 'react';
import type { Layout, Shape } from '@/engine';
import { presetFor, startLabel, type StartChoice } from '@/state/start';
import { codeOf, useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Section, Segmented } from './controls';

const ShapeGuard = lazy(() => import('./ShapeGuard'));

/** Edited: anything but the room differs from the preset it was started from. */
function edited(l: Layout, last: StartChoice): boolean {
  const { room: _room, ...sofa } = l;
  return codeOf(sofa) !== codeOf(presetFor(last));
}

type Pick = Shape | 'T';

const SHAPES: { value: Pick; label: string }[] = [
  { value: 'U', label: 'U' },
  { value: 'L-left', label: 'L left' },
  { value: 'L-right', label: 'L right' },
  { value: 'straight', label: 'Straight' },
];

const choiceFor = (v: Shape): StartChoice =>
  v === 'U' ? { kind: 'standardU' } : v === 'straight' ? { kind: 'standardStraight' } : { kind: 'standardL', side: v === 'L-left' ? 'left' : 'right' };

export function ShapePicker() {
  const store = useHavenStore();
  const live = useLive();
  const joined = useLiveLayout().sections.length > 1;

  const start = (choice: StartChoice) => {
    const s = store.getState();
    // The client's room stays when the shape changes (H6c).
    const room = s.layout.room;
    const next = presetFor(choice);
    s.commitLayout(room ? { ...next, room } : next, { key: 'start' });
    s.setSection('a');
    s.setUi({ lastStart: choice });
    s.toast(`Started a ${startLabel(choice)}`);
  };

  const [asking, setAsking] = useState<Shape | null>(null);

  // A T starts that shape fresh at its standard size (the room stays): the guard says "replaces".
  const switchTo = (v: Shape) => start(choiceFor(v));

  /** Phase 3c: the sofa converts in place (one undo step; the result line says what changed). Loads on first use. */
  const convert = (v: Shape) => void import('./keepActions').then((m) => m.convertShape(store, v, choiceFor(v)));

  const pick = (v: Pick) => {
    if (v === 'T' || (!joined && v === live.shape)) return;
    if (!joined) return convert(v);
    const s = store.getState();
    if (edited(s.layout, s.ui.lastStart)) return setAsking(v);
    switchTo(v);
  };

  return (
    <Section title="Shape">
      <Segmented label="Shape" value={joined ? 'T' : live.shape} options={joined ? [...SHAPES, { value: 'T', label: 'T' }] : SHAPES} onChange={pick} />
      {asking && (
        <Suspense fallback={null}>
          <ShapeGuard label={SHAPES.find((x) => x.value === asking)!.label} onSwitch={() => switchTo(asking)} onClose={() => setAsking(null)} />
        </Suspense>
      )}
    </Section>
  );
}
