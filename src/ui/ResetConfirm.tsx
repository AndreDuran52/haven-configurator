import { Button } from './controls';
import { Dialog } from './Dialog';

/** "Reset to the Standard U?" (plan §8: confirm first when the layout differs). Lazy-loaded. */
export default function ResetConfirm({
  open,
  onOpenChange,
  label,
  onReset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Reset to the ${label}?`} description="Undo brings this layout back.">
      <div className="flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button tone="primary" onClick={onReset}>
          Reset
        </Button>
      </div>
    </Dialog>
  );
}
