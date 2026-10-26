// @vitest-environment jsdom
// UX Phase 1 (Andre, 2026-10-02): typing "38" never shows or commits "3"; the
// size changes only on Enter or leaving the field, as one undo step.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { setMeasurements, standardU } from '@/engine';
import { createHavenStore, HavenStoreProvider } from '@/state/store';
import { MeasureField } from './MeasureField';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const type = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('MeasureField: no change while typing', () => {
  it('"3", a pause, "38": nothing moves until blur; then one commit of D 38', async () => {
    const store = createHavenStore(standardU());
    const el = document.createElement('div');
    document.body.append(el);
    const root = createRoot(el);
    await act(async () =>
      root.render(
        <HavenStoreProvider store={store}>
          <MeasureField name="D" label="D" value={44} apply={(c, v) => setMeasurements(c, { D: v })} />
        </HavenStoreProvider>,
      ),
    );
    const input = el.querySelector('input')!;
    const before = store.getState().config;
    await act(async () => input.focus());
    await act(async () => type(input, '3'));
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(store.getState().draft).toBeNull();
    await act(async () => type(input, '38'));
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect([store.getState().draft, store.getState().config]).toEqual([null, before]);
    await act(async () => input.blur());
    expect(store.getState().config.D).toBe(38);
    expect(store.getState().past).toHaveLength(1);
    act(() => root.unmount());
  });
});
