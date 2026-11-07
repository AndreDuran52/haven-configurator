// The Size tab (editor redesign, Andre 2026-11-06): a T's own panel, the sofa
// size (lock, W/L/R/D with D chips), the client's room (H6c), the corner wedge
// (moved here from under the plan), seat width, arm width, and the warnings.
import { lazy, Suspense, useState } from 'react';
import { ARM_MAX, ARM_MIN, DEPTH_PRESETS, setArmWidth, setLock, setMeasurements, setSeatWidth, type EditResult } from '@/engine';
import { useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Button, Section, Switch } from './controls';
import { MeasureField } from './MeasureField';
import { WarningsList } from './WarningsList';

const SectionsPanel = lazy(() => import('./SectionsPanel'));
// H6c: the client's room (loads after the first paint).
const RoomPanel = lazy(() => import('./RoomPanel'));
// Radix Slider (~7 kB gzip) loads after the first paint, into a placeholder of its height.
const WedgeSlider = lazy(() => import('./WedgeSlider').then((m) => ({ default: m.WedgeSlider })));

export function SizeTab() {
  const store = useHavenStore();
  const live = useLive();
  const joined = useLiveLayout().sections.length > 1;
  /** W/L/R at the moment of unlocking, shown as a reference (UI state, not config). */
  const [atUnlock, setAtUnlock] = useState<{ W: number; L: number; R: number } | null>(null);
  const commit = (r: EditResult, key?: string) => {
    const s = store.getState();
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config, key ? { key } : undefined);
  };
  const locked = live.lockOutside;
  const was = (k: 'W' | 'L' | 'R') =>
    !locked && atUnlock && atUnlock[k] !== live[k] ? `from pieces · was ${atUnlock[k]}″` : !locked ? 'from pieces' : undefined;
  const straight = live.shape === 'straight';
  const hasLeft = live.shape !== 'L-right' && !straight;
  const hasRight = live.shape !== 'L-left' && !straight;

  return (
    <>
      {joined && (
        <Suspense fallback={null}>
          <SectionsPanel />
        </Suspense>
      )}
      <Section
        title="Sofa size"
        aside={
          <Switch
            label="Lock outside size"
            checked={locked}
            onChange={(on) => {
              const c = store.getState().config;
              setAtUnlock(on ? null : { W: c.W, L: c.L, R: c.R });
              commit(setLock(c, on));
            }}
          />
        }
      >
        {!joined && <MeasureField name="W" label="W" value={live.W} apply={(c, v) => setMeasurements(c, { W: v })} hint={was('W')} />}
        {!joined && hasLeft && <MeasureField name="L" label="L" value={live.L} apply={(c, v) => setMeasurements(c, { L: v })} hint={was('L')} />}
        {!joined && hasRight && <MeasureField name="R" label="R" value={live.R} apply={(c, v) => setMeasurements(c, { R: v })} hint={was('R')} />}
        <MeasureField name="D" label="D" value={live.D} apply={(c, v) => setMeasurements(c, { D: v })} />
        <div className="flex gap-2 pl-8" role="group" aria-label="Depth presets">
          {DEPTH_PRESETS.map((d) => (
            <Button
              key={d}
              tone={live.D === d ? 'primary' : 'plain'}
              className="flex-1"
              aria-pressed={live.D === d}
              onClick={() => commit(setMeasurements(store.getState().config, { D: d }))}
            >
              {d}″D
            </Button>
          ))}
        </div>
      </Section>
      <Suspense fallback={<div className="h-16" aria-hidden />}>
        <RoomPanel />
      </Suspense>
      {!straight && (
        <Section title="Corner wedge">
          <Suspense fallback={<div className="h-28" aria-hidden />}>
            <WedgeSlider />
          </Suspense>
        </Section>
      )}
      <Section title="Seat width">
        <div className="flex items-center gap-2">
          <button type="button" className="stepper" aria-label="Seat width minus 1" onClick={() => commit(setSeatWidth(store.getState().config, live.seatWidth - 1), 'seatWidth')}>
            −
          </button>
          <span className="flex-1 text-center text-sm tabular-nums" data-testid="seat-width">
            {live.seatWidth}″ per seat (snug {Math.min(live.snugWidth, live.seatWidth)}″)
          </span>
          <button type="button" className="stepper" aria-label="Seat width plus 1" onClick={() => commit(setSeatWidth(store.getState().config, live.seatWidth + 1), 'seatWidth')}>
            +
          </button>
        </div>
      </Section>
      <Section title="Arm width">
        <div className="flex items-center gap-2">
          <button type="button" className="stepper" aria-label="Arm width minus ½" disabled={live.dims.A <= ARM_MIN} onClick={() => commit(setArmWidth(store.getState().config, live.dims.A - 0.5), 'armWidth')}>
            −
          </button>
          <span className="flex-1 text-center text-sm tabular-nums" data-testid="arm-width">
            {live.dims.A}″ arms
          </span>
          <button type="button" className="stepper" aria-label="Arm width plus ½" disabled={live.dims.A >= ARM_MAX} onClick={() => commit(setArmWidth(store.getState().config, live.dims.A + 0.5), 'armWidth')}>
            +
          </button>
        </div>
      </Section>
      <Section title="Warnings">
        <WarningsList />
      </Section>
    </>
  );
}
