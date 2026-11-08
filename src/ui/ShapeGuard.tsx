// The shape guard (UX Phase 3, Andre 2026-11-08): switching shape on an edited
// layout asks first, so a custom layout is never replaced in front of a
// client. "Save first" saves (then switches); Undo brings the old layout back
// after a switch. Phase 5 upgrades this to keep the old layout as an option.
import { lazy, Suspense, useState } from 'react';
import { Button } from './controls';
import { Dialog } from './Dialog';

const SaveDialog = lazy(() => import('./SaveDialog'));

export default function ShapeGuard({ label, onSwitch, onClose }: { label: string; onSwitch: () => void; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  if (saving) {
    return (
      <Suspense fallback={null}>
        <SaveDialog
          open
          onOpenChange={(o) => !o && onClose()}
          onSaved={() => {
            onSwitch();
            onClose();
          }}
        />
      </Suspense>
    );
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Switch to ${label}?`} description="This replaces your current layout.">
      <div className="flex flex-wrap justify-end gap-2" data-testid="shape-guard">
        <Button onClick={() => setSaving(true)} data-testid="guard-save">
          Save first
        </Button>
        <Button
          tone="primary"
          onClick={() => {
            onSwitch();
            onClose();
          }}
          data-testid="guard-switch"
        >
          Switch
        </Button>
        <Button tone="quiet" onClick={onClose} data-testid="guard-cancel">
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
