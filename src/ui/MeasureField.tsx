// A typed measurement (plan §8): text input with inputMode=decimal, 16 px font
// (no iOS zoom), accepts 188 / 188.5 / 188 1/2 / 15'8". A valid parse drafts
// after 150 ms; blur or Enter commits; Escape cancels. A refused value reverts
// and shows the minimum ("min 158″"). ±1″ steppers commit, coalesced by key.
import { useEffect, useRef, useState } from 'react';
import type { Config, EditResult } from '@/engine';
import { fmtIn, parseInches } from '@/plan/format';
import { useHavenStore } from '@/state/store';

export const DRAFT_DELAY_MS = 150;

const show = (n: number) => fmtIn(n, { mark: false });

export function MeasureField({
  name,
  label,
  value,
  apply,
  hint,
  step = 1,
}: {
  name: 'W' | 'L' | 'R' | 'D';
  label: string;
  /** The live value (draft ?? config). */
  value: number;
  /** The op for a typed value, applied to the committed config. */
  apply: (c: Config, v: number) => EditResult;
  hint?: string;
  step?: number;
}) {
  const store = useHavenStore();
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);
  // Synchronous twin of `editing`: Escape finishes, then blurs; the blur must not commit.
  const active = useRef(false);
  // An error belongs to the value it was shown for: any other change to the field clears it.
  const [errorState, setErrorState] = useState<{ text: string | null; at: number } | null>(null);
  const setError = (text: string | null) => setErrorState(text ? { text, at: store.getState().config[name] } : null);
  const error = errorState && errorState.at === value ? errorState.text : null;
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tryValue = (raw: string): EditResult | null => {
    const v = parseInches(raw);
    if (v === null) return null;
    return apply(store.getState().config, v);
  };

  // The minimum may belong to another measurement (D 44 needs W 158): name it then.
  const message = (r: EditResult) => {
    const min = r.rejected?.min;
    if (!min) return r.rejected?.message ?? null;
    const own = min[name as keyof typeof min];
    if (own !== undefined) return `min ${show(own)}″`;
    const [k, v] = Object.entries(min)[0] ?? [];
    return k !== undefined && v !== undefined ? `Needs ${k === 'C' ? 'wedge' : k} ≥ ${show(v)}″` : (r.rejected?.message ?? null);
  };

  const onChange = (raw: string) => {
    setText(raw);
    setError(null);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = tryValue(raw);
      if (!r) return;
      if (r.rejected) store.getState().cancelDraft();
      else store.getState().setDraft(r.config);
    }, DRAFT_DELAY_MS);
  };

  const finish = (commit: boolean) => {
    window.clearTimeout(timer.current);
    active.current = false;
    setEditing(false);
    const s = store.getState();
    if (!commit) {
      s.cancelDraft();
      setText(show(s.config[name]));
      return;
    }
    const r = tryValue(text);
    if (r && !r.rejected) {
      s.commit(r.config, { key: `measure:${name}` });
      setError(null);
      return;
    }
    s.cancelDraft();
    setText(show(s.config[name]));
    setError(r ? message(r) : 'Not a size');
  };

  const nudge = (d: number) => {
    const s = store.getState();
    const r = apply(s.config, s.config[name] + d);
    if (r.rejected) setError(message(r));
    else {
      setError(null);
      s.commit(r.config, { key: `measure:${name}` });
    }
  };

  const err = error;
  return (
    <div className="flex flex-col gap-1" data-field={name}>
      <div className="flex items-center gap-2">
        <label htmlFor={`m-${name}`} className="w-6 text-sm font-semibold">
          {label}
        </label>
        <button type="button" aria-label={`${label} minus ${step}`} className="stepper" onClick={() => nudge(-step)}>
          −
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={`m-${name}`}
            name={name}
            value={editing ? text : show(value)}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            aria-invalid={!!err}
            onFocus={(e) => {
              setText(show(value));
              active.current = true;
              setEditing(true);
              setError(null);
              e.currentTarget.select();
            }}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => active.current && finish(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                finish(false);
                e.currentTarget.blur();
              }
            }}
            className="h-11 w-full rounded-lg border border-line bg-panel px-3 pr-7 text-base tabular-nums"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">″</span>
        </div>
        <button type="button" aria-label={`${label} plus ${step}`} className="stepper" onClick={() => nudge(step)}>
          +
        </button>
      </div>
      {err && (
        <p role="alert" className="pl-8 text-xs font-medium text-danger" data-error={name}>
          {err}
        </p>
      )}
      {hint && !err && <p className="pl-8 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
