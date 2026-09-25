// Wedge size C (plan §8): a Radix slider over [D, D + 30], step 1, 44 px thumb,
// ± steppers. Dragging drafts from the committed config; release commits (one
// undo step). The part the runs can't absorb is shaded; the engine clamps (G3).
import * as Slider from '@radix-ui/react-slider';
import { WEDGE_RANGE, resetWedge, setWedge, wedgeC, wedgeRange } from '@/engine';
import { useMemo } from 'react';
import { builtOf, useHaven, useHavenStore, useLive } from '@/state/store';
import { Button, WarnChip } from './controls';

export function WedgeSlider() {
  const store = useHavenStore();
  const live = useLive();
  const config = useHaven((s) => s.config);
  const built = builtOf(live);
  const C = wedgeC(live);
  const min = live.D;
  const max = live.D + WEDGE_RANGE;
  const range = useMemo(() => wedgeRange(config), [config]);
  const face = built.warnings.find((w) => w.code === 'wedgeFaceUnder8');
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const draft = (v: number) => {
    const r = setWedge(store.getState().config, v);
    if (!r.rejected) store.getState().setDraft(r.config);
  };
  const commitAt = (v: number) => {
    const s = store.getState();
    const r = setWedge(s.config, v);
    if (r.rejected) {
      s.cancelDraft();
      s.toast(r.rejected.message);
    } else s.commit(r.config, { key: 'wedge' });
  };
  const reset = () => {
    const s = store.getState();
    const r = resetWedge(s.config);
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config);
  };

  return (
    <div className="flex flex-col gap-1" data-testid="wedge">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold" data-testid="wedge-readout">
          {built.wedge.readout}
        </span>
        {face && <WarnChip>angled face {built.wedge.face.toFixed(1)}″</WarnChip>}
        <Button tone="quiet" className="ml-auto" disabled={config.wedgeC === null} onClick={reset}>
          Reset wedge
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="stepper" aria-label="Wedge minus 1" onClick={() => commitAt(C - 1)}>
          −
        </button>
        <Slider.Root
          className="relative flex h-11 flex-1 touch-none items-center select-none"
          min={min}
          max={max}
          step={1}
          value={[C]}
         
          onValueChange={([v]) => v !== undefined && draft(v)}
          onValueCommit={([v]) => v !== undefined && commitAt(v)}
          aria-label="Wedge size C"
        >
          <Slider.Track className="relative h-2 flex-1 overflow-hidden rounded-full bg-line">
            <span
              className="absolute inset-y-0 bg-danger/30"
              style={{ left: `${pct(range.max)}%`, right: 0 }}
              aria-hidden
            />
            <Slider.Range className="absolute h-full rounded-full bg-accent" />
          </Slider.Track>
          <Slider.Thumb
            className="block h-11 w-11 rounded-full border-2 border-accent bg-white shadow-md focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={`Wedge ${C} inches`}
          />
        </Slider.Root>
        <button type="button" className="stepper" aria-label="Wedge plus 1" onClick={() => commitAt(C + 1)}>
          +
        </button>
      </div>
      <div className="flex justify-between px-12 text-xs text-ink-muted tabular-nums">
        <span>{min}″ square</span>
        <span>{max}″</span>
      </div>
    </div>
  );
}
