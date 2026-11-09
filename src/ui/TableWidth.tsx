// The table ± (UX Phase 3c, Andre 2026-11-09): a table's width, typed or
// stepped 1″ at a time (hold to keep going; one undo step per hold). It grows
// from the middle: the seat on each side gives half (resizeTable). Used in the
// Pieces tab's Tables section and in the table's tap menu.
import { findPiece } from '@/engine';
import { resizeTable } from '@/engine/tableSize';
import { useLive } from '@/state/store';
import { MeasureField } from './MeasureField';

export function TableWidth({ id, name }: { id: string; name: string }) {
  const live = useLive();
  const f = findPiece(live, id);
  if (!f) return null;
  return (
    <MeasureField
      name={name}
      label="Width"
      labelClass="w-14"
      value={f.piece.length}
      read={(c) => findPiece(c, id)?.piece.length ?? NaN}
      apply={(c, v) => resizeTable(c, id, v)}
    />
  );
}
