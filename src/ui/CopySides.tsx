// Same both sides of a U (UX Phase 3c, Andre 2026-11-09, Q60): Copy left to
// right | Copy right to left, under the side fields. A mirror copy; each side
// edits on its own after. Lazy (with its action): out of the entry chunk.
import { useHavenStore } from '@/state/store';
import { Button } from './controls';
import { copySideOf } from './keepActions';

export default function CopySides() {
  const store = useHavenStore();
  return (
    <div className="flex gap-2" role="group" aria-label="Same both sides">
      <Button className="flex-1 leading-tight" data-testid="copy-left" onClick={() => copySideOf(store, 'left')}>
        Copy left to right
      </Button>
      <Button className="flex-1 leading-tight" data-testid="copy-right" onClick={() => copySideOf(store, 'right')}>
        Copy right to left
      </Button>
    </div>
  );
}
