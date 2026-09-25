// Small shared controls. Every touch target is at least 44 px (CLAUDE.md rule 10).
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tone = 'plain' | 'primary' | 'quiet';

const TONES: Record<Tone, string> = {
  plain: 'border border-line bg-panel text-ink hover-hover:bg-panel-2 active:bg-panel-2',
  primary: 'bg-accent text-on-accent hover-hover:brightness-110 active:brightness-95',
  quiet: 'text-ink hover-hover:bg-panel-2 active:bg-panel-2',
};

export function Button({ tone = 'plain', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium select-none disabled:opacity-40 ${TONES[tone]} ${className}`}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-md px-2 text-sm font-medium ${o.value === value ? 'bg-panel text-ink shadow-sm' : 'text-ink-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-3 text-sm"
    >
      <span className={`relative h-7 w-12 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${checked ? 'left-6' : 'left-1'}`} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Amber chip for warnings (never blocking). */
export function WarnChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-warn-bg px-2 py-1 text-xs font-medium text-warn-ink">{children}</span>;
}
