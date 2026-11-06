// A typed measurement (plan §8): text input with inputMode=decimal, 16 px font
// (no iOS zoom), accepts 188 / 188.5 / 188 1/2 / 15'8". Nothing changes while
// typing (Andre, UX Phase 1: "38" must never show "3"); blur or Enter commits;
// Escape cancels. A refused value reverts and shows the minimum ("min 158″").
// ±1″ steppers commit, coalesced by key.
import { useRef, useState } from 'react';
import type { Config, EditResult, Layout, LayoutResult, Rejection } from '@/engine';
import { fmtIn, parseInches } from '@/plan/format';
import { useHavenStore } from '@/state/store';

const show = (n: number) => fmtIn(n, { mark: false });

export function MeasureField({
  name,
  label,
  value,
  apply,
  hint,
  step = 1,
  read = (c) => c[name as 'W'],
  labelClass = 'w-6',
  layoutOp,
  readLayout,
}: {
  /** W / L / R / D, or any other field name (then pass `read`). */
  name: string;
  label: string;
  /** The live value (draft ?? config). */
  value: number;
  /** The op for a typed value, applied to the committed config. */
  apply: (c: Config, v: number) => EditResult;
  hint?: string;
  step?: number;
  /** The committed value (default: config[name]). */
  read?: (c: Config) => number;
  labelClass?: string;
  /** Shapes: a field for the whole layout (a T's total width or stem); replaces apply/read. */
  layoutOp?: (l: Layout, v: number) => LayoutResult;
  readLayout?: (l: Layout) => number;
}) {
  const store = useHavenStore();
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);
  // Synchronous twin of `editing`: Escape finishes, then blurs; the blur must not commit.
  const active = useRef(false);
  // An error belongs to the value it was shown for: any other change to the field clears it.
  const [errorState, setErrorState] = useState<{ text: string | null; at: number } | null>(null);
  const committed = () => {
    const s = store.getState();
    return readLayout ? readLayout(s.layout) : read(s.config);
  };
  const setError = (text: string | null) => setErrorState(text ? { text, at: committed() } : null);
  const error = errorState && errorState.at === value ? errorState.text : null;
  /** The op on the committed state, and how to commit it (a section edit can still be refused by the other half). */
  const run = (v: number): { rejected: Rejection | null; commit: () => Rejection | null } => {
    const s = store.getState();
    if (layoutOp) {
      const r = layoutOp(s.layout, v);
      return { rejected: r.rejected, commit: () => (s.commitLayout(r.layout, { key: `measure:${name}` }), null) };
    }
    const r = apply(s.config, v);
    return { rejected: r.rejected, commit: () => s.commit(r.config, { key: `measure:${name}` }) };
  };
  const tryValue = (raw: string) => {
    const v = parseInches(raw);
    return v === null ? null : run(v);
  };

  // The minimum may belong to another measurement (D 44 needs W 158): name it then.
  const message = (r: { rejected: Rejection | null }) => {
    const min = r.rejected?.min;
    if (!min || layoutOp) return r.rejected?.message ?? null;
    const own = min[name as keyof typeof min];
    if (own !== undefined) return `min ${show(own)}″`;
    const [k, v] = Object.entries(min)[0] ?? [];
    return k !== undefined && v !== undefined ? `Needs ${k === 'C' ? 'wedge' : k} ≥ ${show(v)}″` : (r.rejected?.message ?? null);
  };

  const onChange = (raw: string) => {
    setText(raw);
    setError(null);
  };

  const finish = (commit: boolean) => {
    active.current = false;
    setEditing(false);
    if (!commit) {
      setText(show(committed()));
      return;
    }
    const r = tryValue(text);
    if (r && !r.rejected) {
      const refused = r.commit();
      setError(refused ? message({ rejected: refused }) : null);
      if (refused) setText(show(committed()));
      return;
    }
    setText(show(committed()));
    setError(r ? message(r) : 'Not a size');
  };

  const nudge = (d: number) => {
    const r = run(committed() + d);
    if (r.rejected) return setError(message(r));
    const refused = r.commit();
    setError(refused ? message({ rejected: refused }) : null);
  };

  const err = error;
  return (
    <div className="flex flex-col gap-1" data-field={name}>
      <div className="flex items-center gap-2">
        <label htmlFor={`m-${name}`} className={`${labelClass} text-sm font-semibold`}>
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
