// Measurements and settings (plan §8): shape picker, W/L/R/D with D chips, the
// lock, seat width, warnings.
import { useState } from 'react';
import { buildInfo } from '@/buildInfo';
import { DEPTH_PRESETS, setLock, setMeasurements, setSeatWidth, setShape, setTableStyle, type Shape, type TableStyle } from '@/engine';
import { useHavenStore, useLive } from '@/state/store';
import { Button, Section, Segmented, Switch } from './controls';
import { MeasureField } from './MeasureField';
import { WarningsList } from './WarningsList';

const TABLE_STYLES: { value: TableStyle; label: string }[] = [
  { value: 'standard', label: 'Wood top' },
  { value: 'allWood', label: 'All wood' },
];

const SHAPES: { value: Shape; label: string }[] = [
  { value: 'U', label: 'U' },
  { value: 'L-left', label: 'L left' },
  { value: 'L-right', label: 'L right' },
];

export function Sidebar() {
  const store = useHavenStore();
  const live = useLive();
  /** W/L/R at the moment of unlocking, shown as a reference (UI state, not config). */
  const [atUnlock, setAtUnlock] = useState<{ W: number; L: number; R: number } | null>(null);
  const commit = (r: ReturnType<typeof setShape>, key?: string) => {
    const s = store.getState();
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config, key ? { key } : undefined);
  };
  const locked = live.lockOutside;
  const was = (k: 'W' | 'L' | 'R') =>
    !locked && atUnlock && atUnlock[k] !== live[k] ? `from pieces · was ${atUnlock[k]}″` : !locked ? 'from pieces' : undefined;
  const hasLeft = live.shape !== 'L-right';
  const hasRight = live.shape !== 'L-left';
  const hasTable = Object.values(live.runs).some((ps) => ps?.some((p) => p.kind === 'table'));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Section title="Shape">
        <Segmented label="Shape" value={live.shape} options={SHAPES} onChange={(v) => commit(setShape(store.getState().config, v))} />
      </Section>
      <Section
        title="Room"
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
        <MeasureField name="W" label="W" value={live.W} apply={(c, v) => setMeasurements(c, { W: v })} hint={was('W')} />
        {hasLeft && <MeasureField name="L" label="L" value={live.L} apply={(c, v) => setMeasurements(c, { L: v })} hint={was('L')} />}
        {hasRight && <MeasureField name="R" label="R" value={live.R} apply={(c, v) => setMeasurements(c, { R: v })} hint={was('R')} />}
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
      {hasTable && (
        <Section title="Tables">
          <Segmented
            label="Table style"
            value={live.tableStyle}
            options={TABLE_STYLES}
            onChange={(v) => commit(setTableStyle(store.getState().config, v))}
          />
          <p className="text-xs text-ink-muted">
            {live.tableStyle === 'standard' ? '2″ wood top on a fabric base' : 'Solid wood, top to floor'}
          </p>
        </Section>
      )}
      <Section title="Warnings">
        <WarningsList />
      </Section>
      <p className="mt-auto text-xs text-ink-muted" data-testid="build">
        Haven Configurator · build <span className="font-mono">{buildInfo.commit}</span>
      </p>
    </div>
  );
}
