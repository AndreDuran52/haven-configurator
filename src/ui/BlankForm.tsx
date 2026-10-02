// "Blank (place pieces yourself)": shape + W/L/R/D. Used by the Start menu and
// the Projects home (H6b).
import { useState } from 'react';
import type { Shape } from '@/engine';
import { parseInches } from '@/plan/format';
import type { StartChoice } from '@/state/start';
import { Button, Segmented } from './controls';

export function BlankForm({ onStart, onError }: { onStart: (c: StartChoice) => void; onError: (m: string) => void }) {
  const [blank, setBlank] = useState({ shape: 'U' as Shape, W: '188', L: '132', R: '132', D: '44' });
  const startBlank = () => {
    const v = { W: parseInches(blank.W), L: parseInches(blank.L), R: parseInches(blank.R), D: parseInches(blank.D) };
    if (Object.values(v).some((x) => x === null || x <= 0)) return onError('Type every size');
    onStart({ kind: 'blank', shape: blank.shape, W: v.W!, L: v.L!, R: v.R!, D: Math.round(v.D!) });
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <h3 className="text-sm font-semibold">Blank (place pieces yourself)</h3>
      <Segmented
        label="Blank shape"
        value={blank.shape}
        options={[
          { value: 'U', label: 'U' },
          { value: 'L-left', label: 'L left' },
          { value: 'L-right', label: 'L right' },
        ]}
        onChange={(shape) => setBlank({ ...blank, shape })}
      />
      <div className="grid grid-cols-4 gap-2">
        {(['W', 'L', 'R', 'D'] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold">
            {k}
            <input
              value={blank[k]}
              inputMode="decimal"
              onChange={(e) => setBlank({ ...blank, [k]: e.target.value })}
              className="h-11 w-full rounded-lg border border-line bg-panel px-2 text-base tabular-nums"
            />
          </label>
        ))}
      </div>
      <Button onClick={startBlank}>Start blank</Button>
    </div>
  );
}
