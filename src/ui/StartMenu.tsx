// "Start from" (plan §8): Standard U · Standard L (left/right) · Blank (shape +
// W/L/R/D) · "Resume last layout (date)". Each is one undoable commit + a toast,
// and sets ui.lastStart (what Reset returns to). Saved projects moved to the
// Projects home (H6b).
import { useState } from 'react';
import type { Config } from '@/engine';
import { readDraft } from '@/state/draft';
import { presetFor, startLabel, type StartChoice } from '@/state/start';
import { useHavenStore } from '@/state/store';
import { BlankForm } from './BlankForm';
import { Button } from './controls';
import { Dialog } from './Dialog';

export default function StartMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useHavenStore();
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
      <BlankForm onStart={start} onError={setError} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-sm text-ink-muted">Saved projects are on the Projects page (Projects, top left).</p>
    </Dialog>
  );
}
