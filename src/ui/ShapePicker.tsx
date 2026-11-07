// The shape picker on top of the side panel (editor redesign, Andre
// 2026-11-06): U · L left · L right · Straight. A U or L changes shape in
// place (setShape); to or from Straight starts that standard shape fresh. The T is custom work now (hidden 2026-11-06): an opened T shows
// "T" here, and picking a standard shape from it starts that shape fresh at
// its default size. Every change is one undo step.
import { setShape, type Shape } from '@/engine';
import { presetFor, startLabel, type StartChoice } from '@/state/start';
import { useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Section, Segmented } from './controls';

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
    s.commitLayout(presetFor(choice), { key: 'start' });
    s.setSection('a');
    s.setUi({ lastStart: choice });
    s.toast(`Started a ${startLabel(choice)}`);
  };

  const pick = (v: Pick) => {
    if (v === 'T') return;
    const s = store.getState();
    if (joined || v === 'straight' || s.config.shape === 'straight') return start(choiceFor(v));
    const r = setShape(s.config, v);
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config);
  };

  return (
    <Section title="Shape">
      <Segmented label="Shape" value={joined ? 'T' : live.shape} options={joined ? [...SHAPES, { value: 'T', label: 'T' }] : SHAPES} onChange={pick} />
    </Section>
  );
}
