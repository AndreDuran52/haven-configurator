// "Start from" (plan §8): Standard U · Standard L (left/right) · Blank (shape +
// W/L/R/D) · "Resume last layout (date)". Each is one undoable commit + a toast,
// and sets ui.lastStart (what Reset returns to).
import { useState } from 'react';
import type { Config, Shape } from '@/engine';
import { parseInches } from '@/plan/format';
import { readDraft } from '@/state/draft';
import { presetFor, startLabel, type StartChoice } from '@/state/start';
import { useHavenStore } from '@/state/store';
import { Button, Segmented } from './controls';
import { Dialog } from './Dialog';
import { SavedList } from './SavedList';

export default function StartMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useHavenStore();
  const [blank, setBlank] = useState({ shape: 'U' as Shape, W: '188', L: '132', R: '132', D: '44' });
  const [error, setError] = useState<string | null>(null);
  const draft = open ? readDraft() : null;

  const load = (config: Config, text: string, lastStart?: StartChoice) => {
    const s = store.getState();
    s.commit(config, { key: 'start' });
    if (lastStart) s.setUi({ lastStart });
    s.toast(text);
    onOpenChange(false);
  };
  const start = (choice: StartChoice) => {
    try {
      load(presetFor(choice), `Started a ${startLabel(choice)}`, choice);
    } catch {
      setError('Those sizes are too small for this shape');
    }
  };
  const startBlank = () => {
    const v = { W: parseInches(blank.W), L: parseInches(blank.L), R: parseInches(blank.R), D: parseInches(blank.D) };
    if (Object.values(v).some((x) => x === null || x <= 0)) return setError('Type every size');
    start({ kind: 'blank', shape: blank.shape, W: v.W!, L: v.L!, R: v.R!, D: Math.round(v.D!) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Start from" description="Each choice can be undone.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button tone="primary" onClick={() => start({ kind: 'standardU' })}>
          Standard U
        </Button>
        <Button onClick={() => start({ kind: 'standardL', side: 'left' })}>Standard L left</Button>
        <Button onClick={() => start({ kind: 'standardL', side: 'right' })}>Standard L right</Button>
      </div>
      {draft && (
        <Button onClick={() => load(draft.config, 'Resumed the last layout')} data-testid="resume">
          Resume last layout ({new Date(draft.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })})
        </Button>
      )}
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
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Saved on this device</h3>
        {open && <SavedList onOpen={(c, name) => load(c, `Opened "${name}"`)} onToast={(t) => store.getState().toast(t)} />}
      </div>
    </Dialog>
  );
}
