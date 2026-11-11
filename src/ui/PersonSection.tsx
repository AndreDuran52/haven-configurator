// The View menu's Person section, in 3D (Andre, 2026-11-11, plan Q79): show a
// person sitting on the sofa (in the Side drawing and the 3D views), Lounge |
// Upright (Upright puts a square pillow behind the back), and the height: the
// average US man, 5'9″, or the client's own (± 1″, hold to repeat, or typed
// like 6'2). The height and pose are remembered on this device; never in links.
import { useState } from 'react';
import { feetInches, parseHeight, PERSON_MAX, PERSON_MIN, type PersonPose } from '@/ortho/person';
import { writePerson } from '@/state/prefs';
import { useHaven, useHavenStore } from '@/state/store';
import { Stepper } from './Stepper';
import { Toggle } from './Toggle';

export function PersonSection() {
  const store = useHavenStore();
  const on = useHaven((s) => s.ui.person);
  const pose = useHaven((s) => s.ui.personPose);
  const height = useHaven((s) => s.ui.personHeight);
  const [typed, setTyped] = useState<string | null>(null);
  const set = (h: number, p: PersonPose) => {
    const height = Math.min(PERSON_MAX, Math.max(PERSON_MIN, Math.round(h)));
    store.getState().setUi({ personHeight: height, personPose: p });
    writePerson({ height, pose: p });
    return height === Math.round(h);
  };
  const step = (d: number) => {
    const u = store.getState().ui;
    return set(u.personHeight + d, u.personPose);
  };
  const commitTyped = () => {
    const h = typed === null ? null : parseHeight(typed);
    if (h !== null) set(h, pose);
    setTyped(null);
  };
  return (
    <div className="mt-1 flex flex-col border-t border-line pt-1" data-testid="person-section">
      <span className="px-3 pt-1.5 pb-0.5 text-sm font-bold tracking-wide text-ink-muted uppercase">Person</span>
      <Toggle label="Show person" on={on} onChange={(v) => store.getState().setUi({ person: v })} testId="person" />
      {on && (
        <>
          <div role="radiogroup" aria-label="How the person sits" className="mx-3 my-1 flex gap-1 rounded-lg border border-line bg-panel-2 p-0.5">
            {(['lounge', 'upright'] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={pose === v} onClick={() => set(height, v)} className={`min-h-11 flex-1 rounded-md px-3 text-[15px] font-medium ${pose === v ? 'bg-panel text-ink shadow-sm' : 'text-ink-muted'}`}>
                {v === 'lounge' ? 'Lounge' : 'Upright'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-1">
            <Stepper label="Height minus 1" onStep={() => step(-1)}>
              −
            </Stepper>
            <input
              aria-label="Person's height"
              data-testid="person-height"
              value={typed ?? feetInches(height)}
              onChange={(e) => setTyped(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={commitTyped}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setTyped(null);
              }}
              inputMode="text"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 text-center text-base text-ink tabular-nums"
            />
            <Stepper label="Height plus 1" onStep={() => step(1)}>
              +
            </Stepper>
          </div>
        </>
      )}
    </div>
  );
}
