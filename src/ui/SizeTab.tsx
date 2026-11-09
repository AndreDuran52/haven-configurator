// The Size tab: how much floor does it take? (editor redesign, Andre
// 2026-11-06; UX Phase 3; Phase 3b, 2026-11-08): a T's own panel, Width / Left
// side / Right side / Depth, the depth chips 36 · 40 · 44 · Other with the
// seat depth under them (sofa depth − 18: the back frame and back cushion
// never change), the arm width (it changes the footprint and the seats;
// Andre 2026-11-09), the corner wedge, and the sofa's warnings. "When pieces
// change" is on the Pieces tab; the room has its own tab; the seat width for
// the seat count is in the View menu. UX Phase 3c (Andre, 2026-11-09): on a U,
// Copy left to right | Copy right to left (a mirror copy; each side edits on
// its own after).
import { lazy, Suspense } from 'react';
import { DEPTH_PRESETS, setArmWidth, setMeasurements, type EditResult } from '@/engine';
import { fmtIn } from '@/plan/format';
import { builtOf, layoutBuiltOf, useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { Button, Section } from './controls';
import { MeasureField } from './MeasureField';
import { ROOM_CODES } from './warningCodes';
import { WarningsList } from './WarningsList';

const SectionsPanel = lazy(() => import('./SectionsPanel'));
const CopySides = lazy(() => import('./CopySides'));
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
  const straight = live.shape === 'straight';
  const hasLeft = live.shape !== 'L-right' && !straight;
  const hasRight = live.shape !== 'L-left' && !straight;
  const other = !(DEPTH_PRESETS as readonly number[]).includes(live.D);

  return (
    <>
      {joined && (
        <Suspense fallback={null}>
          <SectionsPanel />
        </Suspense>
      )}
      <Section title="Sofa size">
        {!joined && <MeasureField name="W" label="Width" labelClass="w-24" value={live.W} apply={(c, v) => setMeasurements(c, { W: v })} />}
        {!joined && hasLeft && <MeasureField name="L" label="Left side" labelClass="w-24" value={live.L} apply={(c, v) => setMeasurements(c, { L: v })} />}
        {!joined && hasRight && <MeasureField name="R" label="Right side" labelClass="w-24" value={live.R} apply={(c, v) => setMeasurements(c, { R: v })} />}
        {!joined && live.shape === 'U' && (
          <Suspense fallback={<div className="h-11" aria-hidden />}>
            <CopySides />
          </Suspense>
        )}
        <MeasureField name="D" label="Depth" labelClass="w-24" value={live.D} apply={(c, v) => setMeasurements(c, { D: v })} />
        <div className="flex gap-2 pl-26" role="group" aria-label="Depth presets">
          {[...DEPTH_PRESETS].sort((a, b) => a - b).map((d) => (
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
          <Button
            tone={other ? 'primary' : 'plain'}
            className="flex-1"
            aria-pressed={other}
            data-testid="depth-other"
            onClick={() => document.getElementById('m-D')?.focus()}
          >
            Other
          </Button>
        </div>
        <p className="pl-26 text-[15px] text-ink" data-testid="seat-depth">
          Seat depth <span className="font-semibold tabular-nums">{fmtIn(builtOf(live).seatDepth, { mark: false })}″</span>
          <span className="text-ink-muted"> (front edge to the back cushion)</span>
        </p>
        <MeasureField name="A" label="Arm width" labelClass="w-24" step={0.5} value={live.dims.A} read={(c) => c.dims.A} apply={setArmWidth} />
      </Section>
      {!straight && (
        <Section title="Corner wedge">
          <Suspense fallback={<div className="h-28" aria-hidden />}>
            <WedgeSlider />
          </Suspense>
        </Section>
      )}
      {layoutWarnings(layout) > 0 && (
        <Section title="Check these">
          <WarningsList exclude={ROOM_CODES} />
        </Section>
      )}
    </>
  );
}
