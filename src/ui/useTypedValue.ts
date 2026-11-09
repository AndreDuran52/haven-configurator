// A typed size, shared by MeasureField and the Room tab's distances (UX Phase
// 1; split out 2026-11-09). Nothing changes while typing ("38" never shows
// "3"); blur or Enter commits, Escape cancels; a refused value reverts and its
// message shows until the value changes. `nudge` is one ± step on the
// committed value (false when refused, so a hold stops).
import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { Rejection } from '@/engine';
import { fmtIn, parseInches } from '@/plan/format';

/** Blank when there is no value yet (the room before its size is typed). */
export const showInches = (n: number) => (Number.isFinite(n) ? fmtIn(n, { mark: false }) : '');
/** The same shown value (NaN = blank). */
const same = (a: number, b: number) => a === b || (!Number.isFinite(a) && !Number.isFinite(b));

export interface TypedRun {
  rejected: Rejection | null;
  /** Commit it; a section edit can still be refused by the other half. */
  commit: () => Rejection | null;
}

export function useTypedValue({
  value,
  committed,
  run,
  message,
  start,
}: {
  /** The live value (draft ?? config); NaN shows a blank field. */
  value: number;
  /** The committed value, read fresh. */
  committed: () => number;
  /** The op for a value, on the committed state. */
  run: (v: number) => TypedRun;
  /** The words for a refusal. */
  message: (r: { rejected: Rejection | null }) => string | null;
  /** Where ± starts from when the field is blank. */
  start?: number;
}) {
  const [text, setText] = useState(showInches(value));
  const [editing, setEditing] = useState(false);
  // Synchronous twin of `editing`: Escape finishes, then blurs; the blur must not commit.
  const active = useRef(false);
  // An error belongs to the value it was shown for: any other change to the field clears it.
  const [errorState, setErrorState] = useState<{ text: string | null; at: number } | null>(null);
  const setError = (t: string | null) => setErrorState(t ? { text: t, at: committed() } : null);
  const error = errorState && same(errorState.at, value) ? errorState.text : null;

  const finish = (commit: boolean) => {
    active.current = false;
    setEditing(false);
    if (!commit) {
      setText(showInches(committed()));
      return;
    }
    const v = parseInches(text);
    const r = v === null ? null : run(v);
    if (r && !r.rejected) {
      const refused = r.commit();
      setError(refused ? message({ rejected: refused }) : null);
      if (refused) setText(showInches(committed()));
      return;
    }
    setText(showInches(committed()));
    setError(r ? message(r) : 'Not a size');
  };

  const nudge = (d: number) => {
    const c = committed();
    const r = run((Number.isFinite(c) ? c : (start ?? NaN)) + d);
    if (r.rejected) {
      setError(message(r));
      return false;
    }
    const refused = r.commit();
    setError(refused ? message({ rejected: refused }) : null);
    return !refused;
  };

  const input = {
    value: editing ? text : showInches(value),
    inputMode: 'decimal' as const,
    enterKeyHint: 'done' as const,
    autoComplete: 'off',
    'aria-invalid': !!error,
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      setText(showInches(value));
      active.current = true;
      setEditing(true);
      setError(null);
      e.currentTarget.select();
    },
    onChange: (e: { target: { value: string } }) => {
      setText(e.target.value);
      setError(null);
    },
    onBlur: () => active.current && finish(true),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') {
        finish(false);
        e.currentTarget.blur();
      }
    },
  };
  return { error, nudge, input };
}
