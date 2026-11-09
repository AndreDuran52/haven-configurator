// @vitest-environment jsdom
// Phase 3b (Andre, 2026-11-08): "hold ± to keep going". A press steps once; a
// hold repeats after a pause, a little faster as it goes; the whole hold is ONE
// undo step; letting go stops it; a keyboard click steps once.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeasurements, standardU } from '@/engine';
import { createHavenStore, HavenStoreProvider } from '@/state/store';
import { MeasureField } from './MeasureField';
import { HOLD_DELAY_MS } from './Stepper';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pointer = (el: Element, type: string) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, detail: 1 }));

async function mount() {
  const store = createHavenStore(standardU()); // W 188
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  await act(async () =>
    root.render(
      <HavenStoreProvider store={store}>
        <MeasureField name="W" label="Width" value={store.getState().config.W} apply={(c, v) => setMeasurements(c, { W: v })} />
      </HavenStoreProvider>,
    ),
  );
  const plus = el.querySelector('[aria-label="Width plus 1"]')!;
  return { store, plus };
}

describe('Stepper: hold to repeat', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a tap steps once; a held press repeats after a pause; one undo step for the hold', async () => {
    const { store, plus } = await mount();
    const past = store.getState().past.length;
    await act(async () => {
      pointer(plus, 'pointerdown');
      pointer(plus, 'pointerup');
      pointer(plus, 'click');
    });
    expect(store.getState().config.W).toBe(189);
    await act(async () => void vi.advanceTimersByTime(2000)); // a separate press
    await act(async () => void pointer(plus, 'pointerdown'));
    expect(store.getState().config.W).toBe(190);
    await act(async () => void vi.advanceTimersByTime(HOLD_DELAY_MS - 1));
    expect(store.getState().config.W).toBe(190); // the pause
    await act(async () => void vi.advanceTimersByTime(1));
    expect(store.getState().config.W).toBe(191);
    await act(async () => void vi.advanceTimersByTime(600)); // 150, 142, 134, 126 ms: four more
    expect(store.getState().config.W).toBe(195);
    await act(async () => {
      pointer(plus, 'pointerup');
      pointer(plus, 'click');
    });
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(store.getState().config.W).toBe(195); // stopped on release
    expect(store.getState().past.length).toBe(past + 2); // the tap, then the whole hold
    await act(async () => store.getState().undo());
    expect(store.getState().config.W).toBe(189);
  });

  it('a keyboard click (detail 0) steps once; a cancelled touch stops a hold', async () => {
    const { store, plus } = await mount();
    await act(async () => void plus.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })));
    expect(store.getState().config.W).toBe(189);
    await act(async () => void vi.advanceTimersByTime(2000));
    await act(async () => void pointer(plus, 'pointerdown'));
    await act(async () => void pointer(plus, 'pointercancel'));
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(store.getState().config.W).toBe(190);
  });
});
