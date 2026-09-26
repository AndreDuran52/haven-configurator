// Top bar (plan §8): Start, Reset, Undo/Redo, the seat count. Pads with the
// top safe-area inset (status bar / notch) in the installed app.
import { lazy, Suspense, useState } from 'react';
import { encode } from '@/engine';
import { presetFor, startLabel } from '@/state/start';
import { builtOf, useHaven, useHavenStore, useLive } from '@/state/store';
import { Button } from './controls';

// Dialogs load on first open: Radix Dialog stays out of the entry chunk.
const StartMenu = lazy(() => import('./StartMenu'));
const ResetConfirm = lazy(() => import('./ResetConfirm'));

export function TopBar() {
  const store = useHavenStore();
  const canUndo = useHaven((s) => s.past.length > 0 && !s.draft);
  const canRedo = useHaven((s) => s.future.length > 0 && !s.draft);
  const lastStart = useHaven((s) => s.ui.lastStart);
  const seats = builtOf(useLive()).seats.label;
  const [startOpen, setStartOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = () => {
    const s = store.getState();
    s.commit(presetFor(s.ui.lastStart), { key: 'reset' });
    s.toast(`Reset to the ${startLabel(s.ui.lastStart)}`);
    setConfirmReset(false);
  };
  const askReset = () => {
    // Confirm first only when the layout differs from the preset.
    if (encode(store.getState().config) === encode(presetFor(lastStart))) return;
    setConfirmReset(true);
  };

  return (
    <header className="safe-top flex items-center gap-1 border-b border-line bg-panel px-2 sm:gap-2 sm:px-3">
      <span className="mr-1 hidden text-base font-semibold tracking-tight sm:inline">
        Haven <span className="text-accent">Configurator</span>
      </span>
      <Button tone="quiet" onClick={() => setStartOpen(true)}>
        Start
      </Button>
      <Button tone="quiet" onClick={askReset}>
        Reset
      </Button>
      <div className="mx-1 h-6 w-px bg-line" aria-hidden />
      <Button tone="quiet" aria-label="Undo" onClick={() => store.getState().undo()} disabled={!canUndo}>
        Undo
      </Button>
      <Button tone="quiet" aria-label="Redo" onClick={() => store.getState().redo()} disabled={!canRedo}>
        Redo
      </Button>
      <span className="ml-auto rounded-full bg-accent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-on-accent tabular-nums" data-testid="seats">
        {seats}
      </span>
      <Suspense fallback={null}>
        {startOpen && <StartMenu open onOpenChange={setStartOpen} />}
        {confirmReset && <ResetConfirm open onOpenChange={setConfirmReset} label={startLabel(lastStart)} onReset={reset} />}
      </Suspense>
    </header>
  );
}
