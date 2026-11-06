// "T shape…" (Shapes B1): total width, stem, depth and the back down the stem,
// with a live line from the engine. Used by the Projects home and the Start menu.
import { useState } from 'react';
import { buildLayout, DEPTH_PRESETS, teeLayout, teeOf } from '@/engine';
import { fmtIn, parseInches } from '@/plan/format';
import type { StartChoice } from '@/state/start';
import { Button, Segmented } from './controls';

const inch = (n: number) => `${fmtIn(n, { mark: false })}″`;

type Back = 'shared' | 'two';

/** The T for typed sizes, or why not. */
function preview(total: number | null, stem: number | null, D: number | null, sharedBack: boolean) {
  if (!total || !stem || !D || total <= 0 || stem <= 0 || D <= 0) return { error: 'Type every size' };
  try {
    const l = teeLayout({ total, stem, D: Math.round(D), sharedBack });
    const b = buildLayout(l);
    const t = teeOf(l)!;
    if (b.errors.length) return { error: b.errors[0]! };
    return { line: `Each half ${inch(t.left.W)}. Stem ${inch(t.stemWidth)} wide. ${b.seats.label}.` };
  } catch {
    return { error: 'Those sizes are too small for a T' };
  }
}

export default function TeeForm({ onStart, onError }: { onStart: (c: StartChoice) => void; onError: (m: string) => void }) {
  const [v, setV] = useState({ total: '229', stem: '110', D: '44' });
  const [back, setBack] = useState<Back>('shared');
  const nums = { total: parseInches(v.total), stem: parseInches(v.stem), D: parseInches(v.D) };
  const p = preview(nums.total, nums.stem, nums.D, back === 'shared');
  const start = () => {
    if ('error' in p) return onError(p.error ?? 'Type every size');
    onStart({ kind: 'tee', total: nums.total!, stem: nums.stem!, D: Math.round(nums.D!), sharedBack: back === 'shared' });
  };
  const field = (k: keyof typeof v, label: string) => (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      <input
        name={`tee-${k}`}
        value={v[k]}
        inputMode="decimal"
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
        className="h-11 w-full rounded-lg border border-line bg-panel px-2 text-base tabular-nums"
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3" data-testid="tee-form">
      <h3 className="text-sm font-semibold">T shape</h3>
      <div className="grid grid-cols-3 gap-2">
        {field('total', 'Total width')}
        {field('stem', 'Stem')}
        {field('D', 'Depth')}
      </div>
      <div className="flex gap-2" role="group" aria-label="T depth presets">
        {DEPTH_PRESETS.map((d) => (
          <Button key={d} className="flex-1" tone={nums.D === d ? 'primary' : 'plain'} aria-pressed={nums.D === d} onClick={() => setV({ ...v, D: String(d) })}>
            {d}″D
          </Button>
        ))}
      </div>
      <Segmented
        label="Back down the stem"
        value={back}
        options={[
          { value: 'shared', label: 'Shared back' },
          { value: 'two', label: 'Two backs' },
        ]}
        onChange={setBack}
      />
      <p className={`text-sm ${'error' in p ? 'text-danger' : 'text-ink-muted'}`} data-testid="tee-line">
        {'error' in p ? p.error : p.line}
      </p>
      <Button tone="primary" onClick={start} data-testid="tee-start">
        Start T shape
      </Button>
    </div>
  );
}
