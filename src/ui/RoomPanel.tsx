// H6c (Andre, 2026-11-07): the client's room, on its own tab since UX Phase 3. "Add the room"
// starts one a little bigger than the sofa, centred; then its width and depth,
// Center or Back wall, the gaps to the left and back walls, Fill the width.
// Every action is one layout op and one undo step. Loaded lazily.
import { clearRoom, fillRoomWidth, placeRoom, setRoom, setRoomGap, type LayoutResult } from '@/engine';
import { layoutBuiltOf, useHavenStore, useLiveLayout } from '@/state/store';
import { Button, Section, Segmented } from './controls';
import { MeasureField } from './MeasureField';
import { ROOM_CODES } from './warningCodes';
import { WarningsList } from './WarningsList';

const noop = (c: Parameters<Parameters<typeof MeasureField>[0]['apply']>[0]) => ({ config: c, rejected: null });
/** Room sizes start round: the sofa plus 3 ft each side and 8 ft in front, to the next foot. */
const roundUp = (x: number) => Math.ceil(x / 12) * 12;

export default function RoomPanel() {
  const store = useHavenStore();
  const live = useLiveLayout();
  const lb = layoutBuiltOf(live);
  const room = live.room;
  const fit = lb.room;
  const commit = (r: LayoutResult, key?: string) => {
    const s = store.getState();
    if (r.rejected) s.toast(r.rejected.message);
    else s.commitLayout(r.layout, key ? { key } : undefined);
  };
  const gapOf = (wall: 'left' | 'back') => (l: Parameters<typeof layoutBuiltOf>[0]) => layoutBuiltOf(l).room?.gaps[wall] ?? 0;

  if (!room || !fit) {
    return (
      <Section title="Room">
        <Button
          data-testid="add-room"
          onClick={() => commit(setRoom(store.getState().layout, { w: roundUp(lb.overall.W + 72), d: roundUp(lb.overall.depth + 96) }))}
        >
          Add the room
        </Button>
      </Section>
    );
  }
  return (
    <Section
      title="Room"
      aside={
        <Button data-testid="remove-room" className="text-danger" onClick={() => commit(clearRoom(store.getState().layout))}>
          Remove
        </Button>
      }
    >
      <MeasureField name="roomW" label="Room width" labelClass="w-28" value={room.w} apply={noop} layoutOp={(l, v) => setRoom(l, { w: v })} readLayout={(l) => l.room?.w ?? 0} />
      <MeasureField name="roomD" label="Room length" labelClass="w-28" value={room.d} apply={noop} layoutOp={(l, v) => setRoom(l, { d: v })} readLayout={(l) => l.room?.d ?? 0} />
      <Segmented
        label="Sofa in the room"
        value={room.at.mode === 'free' ? ('free' as const) : room.at.mode}
        options={[
          { value: 'center', label: 'Center' },
          { value: 'backWall', label: 'Back wall' },
          ...(room.at.mode === 'free' ? [{ value: 'free' as const, label: 'Placed' }] : []),
        ]}
        onChange={(v) => v !== 'free' && commit(placeRoom(store.getState().layout, v))}
      />
      <MeasureField name="gapLeft" label="Left gap" labelClass="w-28" value={fit.gaps.left} apply={noop} layoutOp={(l, v) => setRoomGap(l, 'left', v)} readLayout={gapOf('left')} />
      <MeasureField name="gapBack" label="Back gap" labelClass="w-28" value={fit.gaps.back} apply={noop} layoutOp={(l, v) => setRoomGap(l, 'back', v)} readLayout={gapOf('back')} />
      {lb.solo && (
        <Button data-testid="fill-width" onClick={() => commit(fillRoomWidth(store.getState().layout))}>
          Fill the width
        </Button>
      )}
      <WarningsList only={ROOM_CODES} />
    </Section>
  );
}
