// Rename the open project (UX Phase 3: the project name's menu). The name stays
// on this device; it never goes in a link.
import { useState } from 'react';
import { renameSaved } from '@/state/savedLayouts';
import { useHaven, useHavenStore } from '@/state/store';
import { Button } from './controls';
import { Dialog } from './Dialog';

export default function RenameDialog({ onClose }: { onClose: () => void }) {
  const store = useHavenStore();
  const project = useHaven((s) => s.ui.project);
  const [name, setName] = useState(project?.name ?? '');
  if (!project) return null;
  const save = () => {
    const s = store.getState();
    const n = name.trim();
    if (!n) return;
    if (!renameSaved(project.id, n)) return s.toast('Could not rename on this device');
    s.setUi({ project: { ...project, name: n } });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Rename project">
      <input
        autoFocus
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className="h-11 rounded-lg border border-line bg-panel px-3 text-base"
        data-testid="rename-name"
        aria-label="Project name"
      />
      <div className="flex justify-end gap-2">
        <Button tone="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button tone="primary" onClick={save} data-testid="rename-confirm">
          Rename
        </Button>
      </div>
    </Dialog>
  );
}
