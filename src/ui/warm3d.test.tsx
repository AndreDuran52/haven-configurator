// @vitest-environment jsdom
// Plan §7.5: iOS Safari has no requestIdleCallback; the 3D warm-up must fall
// back to a timeout, and the App must mount without it.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { WARM_FALLBACK_MS, warm3d } from './warm3d';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('3D warm-up', () => {
  it('uses requestIdleCallback when present, and cancels it', () => {
    const load = vi.fn(() => Promise.resolve());
    const cancel = vi.fn();
    const raf = (cb: FrameRequestCallback) => (cb(0), 1);
    const win = { setTimeout, clearTimeout, requestAnimationFrame: raf, cancelAnimationFrame: () => {}, requestIdleCallback: (cb: () => void) => (cb(), 7), cancelIdleCallback: cancel };
    warm3d(win, load)();
    expect(load).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it(`falls back to a ${WARM_FALLBACK_MS} ms timeout without it`, () => {
    vi.useFakeTimers();
    const load = vi.fn(() => Promise.resolve());
    warm3d(window as never, load);
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100); // two frames: first paint
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(WARM_FALLBACK_MS);
    expect(load).toHaveBeenCalledOnce();
  });

  it('the App mounts with window.requestIdleCallback deleted', async () => {
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const el = document.createElement('div');
    document.body.append(el);
    const root = createRoot(el);
    await act(async () => root.render(<App />));
    expect(el.querySelector('[data-testid=seats]')?.textContent).toBe('Seats 7');
    act(() => root.unmount());
  });
});
