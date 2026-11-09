// A typed measurement (plan §8): text input with inputMode=decimal, 16 px font
// (no iOS zoom), accepts 188 / 188.5 / 188 1/2 / 15'8". Nothing changes while
// typing (Andre, UX Phase 1: "38" must never show "3"); blur or Enter commits;
// Escape cancels (useTypedValue). A refused value reverts and shows the minimum
// ("min 158″"). ±1″ steppers commit, coalesced by key; holding one repeats
// (one undo step).
import type { Config, EditResult, Layout, LayoutResult, Rejection } from '@/engine';
import { useHavenStore } from '@/state/store';
import { Stepper } from './Stepper';
import { showInches as show, useTypedValue, type TypedRun } from './useTypedValue';

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
  placeholder,
  start,
}: {
  /** W / L / R / D, or any other field name (then pass `read`). */
  name: string;
  label: string;
  /** The live value (draft ?? config); NaN shows a blank field. */
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
  /** Shown in a blank field. */
  placeholder?: string;
  /** Where ± starts from when the field is blank. */
  start?: number;
}) {

  const store = useHavenStore();
  const committed = () => {
    const s = store.getState();
    return readLayout ? readLayout(s.layout) : read(s.config);
  };
  /** The op on the committed state, and how to commit it (a section edit can still be refused by the other half). */
  const run = (v: number): TypedRun => {
    const s = store.getState();
    if (layoutOp) {
      const r = layoutOp(s.layout, v);
      return { rejected: r.rejected, commit: () => (s.commitLayout(r.layout, { key: `measure:${name}` }), null) };
    }
    const r = apply(s.config, v);
    return { rejected: r.rejected, commit: () => s.commit(r.config, { key: `measure:${name}` }) };
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
  const { error: err, nudge, input } = useTypedValue({ value, committed, run, message, start });

  return (
    <div className="flex flex-col gap-1" data-field={name}>
      <div className="flex items-center gap-2">
        <label htmlFor={`m-${name}`} className={`${labelClass} text-sm font-semibold`}>
          {label}
        </label>
        <Stepper label={`${label} minus ${step}`} onStep={() => nudge(-step)}>
          −
        </Stepper>
        <div className="relative min-w-0 flex-1">
          <input
            id={`m-${name}`}
            name={name}
            placeholder={placeholder}
            {...input}
            className="h-11 w-full rounded-lg border border-line bg-panel px-3 pr-7 text-base tabular-nums placeholder:text-ink-muted"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">″</span>
        </div>
        <Stepper label={`${label} plus ${step}`} onStep={() => nudge(step)}>
          +
        </Stepper>
      </div>
      {err && (
        <p role="alert" className="pl-8 text-sm font-medium text-danger" data-error={name}>
          {err}
        </p>
      )}
      {hint && !err && <p className="pl-8 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}
