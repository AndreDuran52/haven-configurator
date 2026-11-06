// The shape picker on top of the side panel (editor redesign, Andre
// 2026-11-06): U · L left · L right · T. A single sofa changes shape in place
// (setShape); T opens the T form under the picker; from a T, a standard shape
// starts fresh at its default size. Every change is one undo step.
import { lazy, Suspense, useState } from 'react';
import { setShape, type Shape } from '@/engine';
import { presetFor, startLabel, type StartChoice } from '@/state/start';
import { useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Section, Segmented } from './controls';

const TeeForm = lazy(() => import('./TeeForm'));

type Pick = Shape | 'T';

const SHAPES: { value: Pick; label: string }[] = [
  { value: 'U', label: 'U' },
  { value: 'L-left', label: 'L left' },
  { value: 'L-right', label: 'L right' },
  { value: 'T', label: 'T' },
];

export function ShapePicker() {
  const store = useHavenStore();
  const live = useLive();
  const joined = useLiveLayout().sections.length > 1;
  const [teeOpen, setTeeOpen] = useState(false);
  const value: Pick = joined || teeOpen ? 'T' : live.shape;

  const start = (choice: StartChoice) => {
    const s = store.getState();
    s.commitLayout(presetFor(choice), { key: 'start' });
    s.setSection('a');
    s.setUi({ lastStart: choice });
    s.toast(`Started a ${startLabel(choice)}`);
    setTeeOpen(false);
  };

  const pick = (v: Pick) => {
    const s = store.getState();
    if (v === 'T') {
      if (!joined) setTeeOpen(!teeOpen);
      return;
    }
    setTeeOpen(false);
    if (joined) return start(v === 'U' ? { kind: 'standardU' } : { kind: 'standardL', side: v === 'L-left' ? 'left' : 'right' });
    const r = setShape(s.config, v);
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config);
  };

  return (
    <Section title="Shape">
      <Segmented label="Shape" value={value} options={SHAPES} onChange={pick} />
      {teeOpen && !joined && (
        <Suspense fallback={null}>
          <TeeForm onStart={start} onError={(m) => store.getState().toast(m)} />
        </Suspense>
      )}
    </Section>
  );
}
