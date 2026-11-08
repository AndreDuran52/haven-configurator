// Top bar (UX Phase 3, Andre 2026-11-08; shared over Zoom, so it stays plain).
// Left: back to Projects, the project name (its menu: Rename, Reset, Start
// new), Undo and Redo arrows. Right: the seat count as text, Share, Save (the
// one tan button, with a dot when there are unsaved changes), and Settings
// (seat width for the seat count, the build). ?view shows "View only" and
// "Edit a copy" instead. Pads with the top safe-area inset in the installed app.
import { lazy, Suspense, useState } from 'react';
import { buildInfo } from '@/buildInfo';
import { setSeatWidth } from '@/engine';
import { presetFor, startLabel } from '@/state/start';
import { codeOf, isDirty, layoutBuiltOf, useHaven, useHavenStore, useLive, useLiveLayout } from '@/state/store';
import { editUrl } from '@/state/url';
import { Button } from './controls';
import { Menu, MenuItem } from './Menu';

// Dialogs load on first open: Radix Dialog stays out of the entry chunk.
const StartMenu = lazy(() => import('./StartMenu'));
const ResetConfirm = lazy(() => import('./ResetConfirm'));
const SaveDialog = lazy(() => import('./SaveDialog'));
const ShareDialog = lazy(() => import('./ShareDialog'));
const RenameDialog = lazy(() => import('./RenameDialog'));

const Arrow = ({ flip = false }: { flip?: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

const Gear = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export function TopBar() {
  const store = useHavenStore();
  const canUndo = useHaven((s) => s.past.length > 0 && !s.draft);
  const canRedo = useHaven((s) => s.future.length > 0 && !s.draft);
  const lastStart = useHaven((s) => s.ui.lastStart);
  const seats = layoutBuiltOf(useLiveLayout()).seats.label;
  const live = useLive();
  const [startOpen, setStartOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveOpen, setSaveOpen] = useState<false | 'save' | 'leave'>(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const readOnly = useHaven((s) => s.ui.readOnly);
  const project = useHaven((s) => s.ui.project);
  const dirty = useHaven(isDirty);
  // Unsaved changes: ask first (the draft keeps only the last layout).
  const toProjects = () => (isDirty(store.getState()) ? setSaveOpen('leave') : store.getState().goHome());

  const reset = () => {
    const s = store.getState();
    s.commitLayout(presetFor(s.ui.lastStart), { key: 'reset' });
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
    if (codeOf(store.getState().layout) === codeOf(presetFor(lastStart))) return;
    setConfirmReset(true);
  };
  const seatWidth = (w: number) => {
    const s = store.getState();
    const r = setSeatWidth(s.config, w);
    if (r.rejected) s.toast(r.rejected.message);
    else s.commit(r.config, { key: 'seatWidth' });
  };

  return (
    <header className="safe-top flex min-w-0 items-center gap-0.5 overflow-hidden border-b border-line bg-panel px-1 sm:gap-2 sm:px-3">
      {readOnly ? (
        <>
          <span className="mr-1 hidden text-base font-semibold tracking-tight sm:inline">
            Haven <span className="text-accent">Configurator</span>
          </span>
          <span className="rounded-full bg-panel-2 px-3 py-1.5 text-sm font-medium text-ink" data-testid="view-only">
            View only
          </span>
          <Button tone="primary" onClick={editCopy} data-testid="edit-copy">
            Edit a copy
          </Button>
        </>
      ) : (
        <>
          <Button tone="quiet" onClick={toProjects} data-testid="projects" aria-label="Projects" className="text-[15px] font-semibold">
            <span aria-hidden className="text-xl leading-none">‹</span>
            <span className="max-sm:hidden">Projects</span>
          </Button>
          <Menu
            label={`Project: ${project?.name ?? 'Untitled layout'}`}
            testId="project-name"
            button={
              <>
                <span className="truncate max-sm:max-w-20 sm:max-w-56" title={project?.name}>
                  {project?.name ?? 'Untitled layout'}
                </span>
                <span aria-hidden className="text-sm">▾</span>
              </>
            }
          >
            {(close) => (
              <>
                {project && (
                  <MenuItem testId="menu-rename" onSelect={() => (close(), setRenaming(true))}>
                    Rename
                  </MenuItem>
                )}
                <MenuItem testId="menu-reset" onSelect={() => (close(), askReset())}>
                  Reset to the {startLabel(lastStart)}
                </MenuItem>
                <MenuItem testId="menu-start" onSelect={() => (close(), setStartOpen(true))}>
                  Start new…
                </MenuItem>
              </>
            )}
          </Menu>
          <div className="mx-0.5 h-6 w-px bg-line max-sm:hidden" aria-hidden />
          <Button tone="quiet" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={() => store.getState().undo()} disabled={!canUndo}>
            <Arrow />
          </Button>
          <Button tone="quiet" aria-label="Redo" title="Redo (Shift+Ctrl+Z)" className="max-sm:hidden" onClick={() => store.getState().redo()} disabled={!canRedo}>
            <Arrow flip />
          </Button>
        </>
      )}
      <span className="ml-auto pr-1 text-[15px] font-semibold whitespace-nowrap text-ink tabular-nums max-sm:hidden" data-testid="seats">
        {seats}
      </span>
      <Button tone="quiet" onClick={() => setShareOpen(true)} data-testid="share" className="text-[15px] max-sm:ml-auto max-sm:px-2">
        Share
      </Button>
      {!readOnly && (
        <>
          <Button tone="primary" onClick={() => setSaveOpen('save')} data-testid="save" className="relative text-[15px] font-semibold max-sm:px-2.5">
            Save
            {dirty && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel bg-warn-ink" aria-hidden data-testid="unsaved-dot" />}
          </Button>
          <div className="max-sm:hidden">
          <Menu label="Settings" testId="settings" align="right" button={<Gear />}>
            {() => (
              <div className="flex flex-col gap-2 p-2" data-testid="settings-panel">
                <span className="text-[15px] font-semibold text-ink">Seat count</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="stepper" aria-label="Seat width minus 1" onClick={() => seatWidth(live.seatWidth - 1)}>
                    −
                  </button>
                  <span className="flex-1 text-center text-[15px] tabular-nums" data-testid="seat-width">
                    {live.seatWidth}″ per seat (snug {Math.min(live.snugWidth, live.seatWidth)}″)
                  </span>
                  <button type="button" className="stepper" aria-label="Seat width plus 1" onClick={() => seatWidth(live.seatWidth + 1)}>
                    +
                  </button>
                </div>
                <p className="border-t border-line pt-2 text-sm text-ink-muted" data-testid="build">
                  Haven Configurator · build <span className="font-mono">{buildInfo.commit}</span>
                </p>
              </div>
            )}
          </Menu>
          </div>
        </>
      )}
      <Suspense fallback={null}>
        {startOpen && <StartMenu open onOpenChange={setStartOpen} />}
        {confirmReset && <ResetConfirm open onOpenChange={setConfirmReset} label={startLabel(lastStart)} onReset={reset} />}
        {saveOpen && <SaveDialog open onOpenChange={(o) => setSaveOpen(o && saveOpen)} leaving={saveOpen === 'leave'} />}
        {shareOpen && <ShareDialog open onOpenChange={setShareOpen} />}
        {renaming && <RenameDialog onClose={() => setRenaming(false)} />}
      </Suspense>
    </header>
  );
}
