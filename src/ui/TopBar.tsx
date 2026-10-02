// Top bar (plan §8): Projects (H6b), Start, Reset, Undo/Redo, Save, Share, the
// seat count; ?view shows "View only" and "Edit a copy" instead. Pads with the
// top safe-area inset (status bar / notch) in the installed app.
import { lazy, Suspense, useState } from 'react';
import { encode } from '@/engine';
import { presetFor, startLabel } from '@/state/start';
import { builtOf, isDirty, useHaven, useHavenStore, useLive } from '@/state/store';
import { editUrl } from '@/state/url';
import { Button } from './controls';

// Dialogs load on first open: Radix Dialog stays out of the entry chunk.
const StartMenu = lazy(() => import('./StartMenu'));
const ResetConfirm = lazy(() => import('./ResetConfirm'));
const SaveDialog = lazy(() => import('./SaveDialog'));
const ShareDialog = lazy(() => import('./ShareDialog'));

export function TopBar() {
  const store = useHavenStore();
  const canUndo = useHaven((s) => s.past.length > 0 && !s.draft);
  const canRedo = useHaven((s) => s.future.length > 0 && !s.draft);
  const lastStart = useHaven((s) => s.ui.lastStart);
  const seats = builtOf(useLive()).seats.label;
  const [startOpen, setStartOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveOpen, setSaveOpen] = useState<false | 'save' | 'leave'>(false);
  const [shareOpen, setShareOpen] = useState(false);
  const readOnly = useHaven((s) => s.ui.readOnly);
  const project = useHaven((s) => s.ui.project);
  const dirty = useHaven(isDirty);
  // Unsaved changes: ask first (the draft keeps only the last layout).
  const toProjects = () => (isDirty(store.getState()) ? setSaveOpen('leave') : store.getState().goHome());

  const reset = () => {
    const s = store.getState();
    s.commit(presetFor(s.ui.lastStart), { key: 'reset' });
    s.toast(`Reset to the ${startLabel(s.ui.lastStart)}`);
    setConfirmReset(false);
  };
  // ?view: "Edit a copy" drops ?view and keeps the layout (plan §9).
  const editCopy = () => {
    window.history.replaceState(window.history.state, '', editUrl(window.location));
    store.getState().setUi({ readOnly: false });
  };
  const askReset = () => {
    // Confirm first only when the layout differs from the preset.
    if (encode(store.getState().config) === encode(presetFor(lastStart))) return;
    setConfirmReset(true);
  };

  return (
    <header className="safe-top flex items-center gap-1 border-b border-line bg-panel px-2 sm:gap-2 sm:px-3">
      {readOnly ? (
        <span className="mr-1 hidden text-base font-semibold tracking-tight sm:inline">
          Haven <span className="text-accent">Configurator</span>
        </span>
      ) : (
        <>
          <Button tone="quiet" onClick={toProjects} data-testid="projects">
            Projects
          </Button>
          {project && (
            <span className="max-w-40 truncate text-sm font-semibold max-lg:hidden" data-testid="project-name" title={project.name}>
              {project.name}
              {dirty && <span className="text-ink-muted"> ·&nbsp;edited</span>}
            </span>
          )}
        </>
      )}
      {readOnly ? (
        <>
          <span className="rounded-full bg-panel-2 px-3 py-1.5 text-sm font-medium text-ink-muted" data-testid="view-only">
            View only
          </span>
          <Button tone="primary" onClick={editCopy} data-testid="edit-copy">
            Edit a copy
          </Button>
        </>
      ) : (
        <>
          <Button tone="quiet" className="max-sm:hidden" onClick={() => setStartOpen(true)}>
            Start
          </Button>
          {/* Phones: Reset and Save live elsewhere (Start; a link to share), so the bar fits 390 px. */}
          <Button tone="quiet" className="max-sm:hidden" onClick={askReset}>
            Reset
          </Button>
          <div className="mx-1 h-6 w-px bg-line max-sm:hidden" aria-hidden />
          <Button tone="quiet" aria-label="Undo" onClick={() => store.getState().undo()} disabled={!canUndo}>
            Undo
          </Button>
          <Button tone="quiet" aria-label="Redo" onClick={() => store.getState().redo()} disabled={!canRedo}>
            Redo
          </Button>
          <div className="mx-1 h-6 w-px bg-line max-sm:hidden" aria-hidden />
          <Button tone="quiet" className="max-sm:hidden" onClick={() => setSaveOpen('save')}>
            Save
          </Button>
        </>
      )}
      <Button tone="quiet" onClick={() => setShareOpen(true)} data-testid="share">
        Share
      </Button>
      <span className="ml-auto rounded-full bg-accent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-on-accent tabular-nums" data-testid="seats">
        {seats}
      </span>
      <Suspense fallback={null}>
        {startOpen && <StartMenu open onOpenChange={setStartOpen} />}
        {confirmReset && <ResetConfirm open onOpenChange={setConfirmReset} label={startLabel(lastStart)} onReset={reset} />}
        {saveOpen && <SaveDialog open onOpenChange={(o) => setSaveOpen(o && saveOpen)} leaving={saveOpen === 'leave'} />}
        {shareOpen && <ShareDialog open onOpenChange={setShareOpen} />}
      </Suspense>
    </header>
  );
}
