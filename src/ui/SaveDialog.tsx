// Save (plan §8 "Saved layouts"; H6b projects): an open project is saved in
// place, or saved as a new one under a name. `leaving`: asked by the Projects
// button when there are unsaved changes ("Save first?"). Stored on this device
// (localStorage); the name never goes in a link.
import { useState } from 'react';
import { encode } from '@/engine';
import { saveLayout, updateSaved } from '@/state/savedLayouts';
import { useHaven, useHavenStore } from '@/state/store';
import { Button } from './controls';
import { Dialog } from './Dialog';

export default function SaveDialog({ open, onOpenChange, leaving = false }: { open: boolean; onOpenChange: (o: boolean) => void; leaving?: boolean }) {
  const store = useHavenStore();
  const project = useHaven((s) => s.ui.project);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = (saved: { id: string; name: string } | null) => {
    const s = store.getState();
    if (!saved) return setError("Can't save on this device (storage is off or full). Share a link instead.");
    s.setUi({ project: { id: saved.id, name: saved.name, code: encode(s.config) } });
    s.toast(`Saved "${saved.name}"`);
    onOpenChange(false);
    if (leaving) s.goHome();
  };
  const saveInPlace = () => {
    const s = store.getState();
    // The project was deleted meanwhile (another tab): save it again as new.
    done(updateSaved(project!.id, s.config) ?? saveLayout(project!.name, s.config));
  };
  const saveNew = () => done(saveLayout(name, store.getState().config));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={leaving ? 'Save before leaving?' : project ? `Save "${project.name}"` : 'Save project'}
      description={leaving ? 'This layout has changes that are not saved.' : 'Saved on this device. Open it again from Projects.'}
    >
      {project && (
        <Button tone="primary" onClick={saveInPlace} data-testid="save-project">
          Save "{project.name}"
        </Button>
      )}
      <label className="flex flex-col gap-1 text-sm">
        {project ? 'Or save as a new project' : 'Name'}
        <input
          autoFocus={!project}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveNew()}
          placeholder="e.g. Mitchell, family room"
          className="h-11 rounded-lg border border-line bg-panel px-3 text-base"
          data-testid="save-name"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button tone={project ? 'plain' : 'primary'} onClick={saveNew} data-testid="save-confirm">
        {project ? 'Save as new' : 'Save'}
      </Button>
      {leaving && (
        <Button
          tone="quiet"
          className="text-danger"
          onClick={() => {
            onOpenChange(false);
            store.getState().goHome();
          }}
          data-testid="leave-unsaved"
        >
          Don't save, go to Projects
        </Button>
      )}
    </Dialog>
  );
}
