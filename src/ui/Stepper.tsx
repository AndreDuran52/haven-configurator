// A ± button that repeats while held (Phase 3b, Andre 2026-11-08: "hold ± to
// keep going"). The press steps once at once; after a short pause it repeats,
// a little faster the longer it's held. Every step commits with the caller's
// key, and the repeats come well inside the history's coalescing window, so a
// whole hold is ONE undo step. Mouse, touch and pen alike (pointer events); a
// keyboard Enter / Space still steps once. `onStep` returning false (a refused
// step) ends the hold.
import { useEffect, useRef, type ReactNode } from 'react';

/** The pause before repeating, then the repeat interval: from START down to FASTEST. */
export const HOLD_DELAY_MS = 400;
const START_MS = 150;
const FASTEST_MS = 60;
const SPEED_UP_MS = 8;

export function Stepper({
  label,
  onStep,
  disabled = false,
  className = 'stepper',
  children,
  testId,
}: {
  label: string;
  /** One step; reads fresh state each time. Return false to stop repeating. */
  onStep: () => boolean | void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  // The latest handler and state, read by the repeat timer.
  const step = useRef(onStep);
  const off = useRef(disabled);
  useEffect(() => {
    step.current = onStep;
    off.current = disabled;
  });
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const fire = () => !off.current && step.current() !== false;
  const repeat = (n: number) => {
    timer.current = window.setTimeout(
      () => {
        if (fire()) repeat(n + 1);
        else stop();
      },
      n === 0 ? HOLD_DELAY_MS : Math.max(FASTEST_MS, START_MS - n * SPEED_UP_MS),
    );
  };

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      style={{ touchAction: 'manipulation' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        stop();
        if (fire()) repeat(0);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onBlur={stop}
      // The pointer already stepped; only a keyboard click (detail 0) steps here.
      onClick={(e) => e.detail === 0 && fire()}
    >
      {children}
    </button>
  );
}
