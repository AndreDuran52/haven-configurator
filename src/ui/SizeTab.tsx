// The Size tab (editor redesign, Andre 2026-11-06; UX Phase 3, 2026-11-08): a
// T's own panel, the sofa size ("When pieces change: Keep sofa size | Let sofa
// grow", Width / Left side / Right side / Depth with depth chips), the corner
// wedge, arm width, and the sofa's warnings. The room has its own tab; the
// seat width for the seat count is in the settings menu.
import { lazy, Suspense } from 'react';
import { ARM_MAX, ARM_MIN, DEPTH_PRESETS, setArmWidth, setLock, setMeasurements, type EditResult } from '@/engine';
import { layoutBuiltOf, useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Button, Section, Segmented } from './controls';
import { MeasureField } from './MeasureField';
import { ROOM_CODES } from './warningCodes';
import { WarningsList } from './WarningsList';

const SectionsPanel = lazy(() => import('./SectionsPanel'));
// Radix Slider (~7 kB gzip) loads after the first paint, into a placeholder of its height.
const WedgeSlider = lazy(() => import('./WedgeSlider').then((m) => ({ default: m.WedgeSlider })));

/** The sofa's own warnings (the room's are on the Room tab). */
const layoutWarnings = (l: Parameters<typeof layoutBuiltOf>[0]) => layoutBuiltOf(l).warnings.filter((w) => !ROOM_CODES.includes(w.code)).length;

export function SizeTab() {
  const store = useHavenStore();
  const live = useLive();
  const layout = useLiveLayout();
  const joined = layout.sections.length > 1;
  const commit = (r: EditResult, key?: string) => {
    const s = store.getState();
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config, key ? { key } : undefined);
  };
  const locked = live.lockOutside;
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
      <Section title="Sofa size">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">When pieces change</span>
          <Segmented
            label="When pieces change"
            value={locked ? 'keep' : 'grow'}
            options={[
              { value: 'keep', label: 'Keep sofa size' },
              { value: 'grow', label: 'Let sofa grow' },
            ]}
            onChange={(v) => commit(setLock(store.getState().config, v === 'keep'))}
          />
        </div>
        {!joined && <MeasureField name="W" label="Width" labelClass="w-24" value={live.W} apply={(c, v) => setMeasurements(c, { W: v })} />}
        {!joined && hasLeft && <MeasureField name="L" label="Left side" labelClass="w-24" value={live.L} apply={(c, v) => setMeasurements(c, { L: v })} />}
        {!joined && hasRight && <MeasureField name="R" label="Right side" labelClass="w-24" value={live.R} apply={(c, v) => setMeasurements(c, { R: v })} />}
        <MeasureField name="D" label="Depth" labelClass="w-24" value={live.D} apply={(c, v) => setMeasurements(c, { D: v })} />
        <div className="flex gap-2 pl-26" role="group" aria-label="Depth presets">
          {DEPTH_PRESETS.map((d) => (
            <Button
              key={d}
              tone={live.D === d ? 'primary' : 'plain'}
              className="flex-1"
              aria-pressed={live.D === d}
              onClick={() => commit(setMeasurements(store.getState().config, { D: d }))}
            >
              {d}″
            </Button>
          ))}
        </div>
      </Section>
      {!straight && (
        <Section title="Corner wedge">
          <Suspense fallback={<div className="h-28" aria-hidden />}>
            <WedgeSlider />
          </Suspense>
        </Section>
      )}
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
      {layoutWarnings(layout) > 0 && (
        <Section title="Check these">
          <WarningsList exclude={ROOM_CODES} />
        </Section>
      )}
    </>
  );
}
