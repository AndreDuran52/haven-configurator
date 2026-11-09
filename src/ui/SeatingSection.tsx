// The View menu's Seating section (Andre, 2026-11-09): the numbered seat
// markers (in the plan and 3D Top, where they draw; off when a layout opens),
// Snug (count 24″ seats: saved with the layout, so the link and the PDF say
// "Seats 8 · snug"; one undo step) and the seat width (moved from Settings;
// hold ± to repeat). The top bar, the markers and the PDF read one number.
import { setSeatWidth, setSnug } from '@/engine';
import type { PresetName } from '@/ortho/presets';
import { useHaven, useHavenStore, useLive } from '@/state/store';
import { Stepper } from './Stepper';
import { Toggle } from './Toggle';

export function SeatingSection({ view, preset }: { view: 'plan' | '3d'; preset: PresetName }) {
  const store = useHavenStore();
  const markers = useHaven((s) => s.ui.markers);
  const snug = useHaven((s) => !!s.layout.snug);
  const live = useLive();
  const snugWidth = Math.min(live.snugWidth, live.seatWidth);
  /** ±1″ from the committed seat width (fresh on every repeat of a hold). */
  const seatWidth = (d: number) => {
    const s = store.getState();
    const r = setSeatWidth(s.config, s.config.seatWidth + d);
    if (r.rejected) {
      s.toast(r.rejected.message);
      return false;
    }
    s.commit(r.config, { key: 'seatWidth' });
  };
  return (
    <div className="mt-1 flex flex-col border-t border-line pt-1" data-testid="seating">
      <span className="px-3 pt-1.5 pb-0.5 text-sm font-bold tracking-wide text-ink-muted uppercase">Seating</span>
      {(view === 'plan' || preset === 'top') && <Toggle label="Seat markers" on={markers} onChange={(on) => store.getState().setUi({ markers: on })} testId="markers" />}
      <Toggle
        label={`Snug (${snugWidth}″ seats)`}
        on={snug}
        onChange={(on) => {
          const s = store.getState();
          s.commitLayout(setSnug(s.layout, on).layout);
        }}
        testId="snug"
      />
      <div className="flex items-center gap-2 px-3 py-1">
        <Stepper label="Seat width minus 1" onStep={() => seatWidth(-1)}>
          −
        </Stepper>
        <span className="flex-1 text-center text-[15px] text-ink tabular-nums" data-testid="seat-width">
          {live.seatWidth}″ seats
        </span>
        <Stepper label="Seat width plus 1" onStep={() => seatWidth(1)}>
          +
        </Stepper>
      </div>
    </div>
  );
}
