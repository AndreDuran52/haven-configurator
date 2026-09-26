// Save (plan §8 "Saved layouts"): a name, then the layout is stored on this
// device (localStorage). The name stays on the device: never in the link.
import { useState } from 'react';
import { saveLayout } from '@/state/savedLayouts';
import { useHavenStore } from '@/state/store';
import { Button } from './controls';
import { Dialog } from './Dialog';

export default function SaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useHavenStore();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const s = store.getState();
    const e = saveLayout(name, s.config);
    if (!e) return setError("Can't save on this device (storage is off or full). Share a link instead.");
    s.toast(`Saved "${e.name}"`);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Save layout" description="Saved on this device only. Open it again from Start.">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
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
      <Button tone="primary" onClick={save} data-testid="save-confirm">
        Save
      </Button>
    </Dialog>
  );
}
