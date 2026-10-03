// The Projects home (H6b, Andre 2026-10-02: "a home screen where we can see the
// Haven configs we have saved"). The app opens here unless a link or ?view
// opens a layout. New Haven, Continue last layout, the saved projects, and a
// backup file: projects live on this device only (no login, plan H7), so the
// file is how they move between the iPad and the laptop or survive the browser
// clearing its storage. Lazy-loaded.
import { useRef, useState } from 'react';
import type { Config } from '@/engine';
import { readDraft } from '@/state/draft';
import { exportSaved, importSaved, listSaved, savedDate } from '@/state/savedLayouts';
import { presetFor, type StartChoice } from '@/state/start';
import { useHavenStore } from '@/state/store';
import { BlankForm } from './BlankForm';
import { Button } from './controls';
import { PlanThumb } from './PlanThumb';
import { SavedList, type OpenProject } from './SavedList';
import { UpdateChip } from './UpdateChip';

export default function ProjectsHome() {
  const store = useHavenStore();
  const [list, setList] = useState(listSaved);
  const [draft] = useState(readDraft);
  const [blank, setBlank] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const toast = (t: string) => store.getState().toast(t);

  const start = (choice: StartChoice) => {
    let config: Config;
    try {
      config = presetFor(choice);
    } catch {
      return setError('Those sizes are too small for this shape');
    }
    store.getState().open(config, { lastStart: choice });
  };
  const openProject: OpenProject = (config, project) => {
    store.getState().open(config, { project });
    toast(`Opened "${project.name}"`);
  };
  const backup = async () => {
    const { download } = await import('@/export/share');
    const name = `haven-projects-${new Date().toISOString().slice(0, 10)}.json`;
    download(new Blob([exportSaved()], { type: 'application/json' }), name);
    toast(`Downloaded ${name}`);
  };
  const restore = async (f: File | undefined) => {
    if (!f) return;
    const r = importSaved(await f.text());
    if (file.current) file.current.value = '';
    if ('error' in r) return toast(r.error === 'storage' ? "Can't save on this device (storage is off or full)" : 'That file is not a Haven projects backup');
    setList(listSaved());
    toast(`Restored: ${r.added} added, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ''}`);
  };

  return (
    <div className="safe-top safe-x safe-bottom h-dvh overflow-y-auto overscroll-contain bg-canvas text-ink" data-testid="projects-home">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Haven <span className="text-accent">projects</span>
          </h1>
          <p className="text-sm text-ink-muted">Saved on this device</p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">New Haven</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button tone="primary" onClick={() => start({ kind: 'standardU' })} data-testid="new-standardU">
              Standard U
            </Button>
            <Button onClick={() => start({ kind: 'standardL', side: 'left' })}>Standard L left</Button>
            <Button onClick={() => start({ kind: 'standardL', side: 'right' })}>Standard L right</Button>
            <Button onClick={() => setBlank(!blank)} aria-expanded={blank}>
              Blank…
            </Button>
          </div>
          {blank && <BlankForm onStart={start} onError={setError} />}
          {error && <p className="text-sm text-danger">{error}</p>}
        </section>

        {draft && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Last layout (not saved as a project)</h2>
            <button
              type="button"
              onClick={() => store.getState().open(draft.config)}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-panel p-2 text-left"
              data-testid="continue"
            >
              <span className="h-20 w-32 shrink-0 rounded-lg bg-white p-1">
                <PlanThumb config={draft.config} />
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">Continue last layout</span>
                <span className="text-xs text-ink-muted">{savedDate(draft.savedAt)}</span>
              </span>
            </button>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Saved projects ({list.length})</h2>
          <SavedList list={list} onChange={() => setList(listSaved())} onOpen={openProject} onToast={toast} />
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={backup} disabled={!list.length} data-testid="backup">
              Back up all projects
            </Button>
            <Button onClick={() => file.current?.click()} data-testid="restore">
              Restore from file
            </Button>
            <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} data-testid="restore-file" />
          </div>
          <p className="text-xs text-ink-muted">
            Projects stay on this device and this browser (the home-screen app keeps its own list). Back up to a file to move them to another device, or in case the
            browser clears its storage. Shared links never carry project names.
          </p>
        </section>
      </div>
      <UpdateChip />
    </div>
  );
}
