// The Room tab: where does it go? (H6c, Andre 2026-11-07; Phase 3b,
// 2026-11-08; 2026-11-09). No "Add" step: typing the room width or length
// creates the room (the other starts a little bigger than the sofa). Then Sofa
// position (Center · Back wall · Custom), two rows "Side to side" and "Front to
// back" (arrows and typed gaps, RoomGapRow), Fill the width, Remove, and the
// room's other warnings. Every action is one layout op. Loaded lazily.
import { clearRoom, fillRoomWidth, placeRoom, setRoom, setRoomGap, type Layout, type LayoutResult } from '@/engine';
import { layoutBuiltOf, useHavenStore, useLiveLayout } from '@/state/store';
import { Button, Section, Segmented } from './controls';
import { MeasureField } from './MeasureField';
import { RoomGapRow } from './RoomGapRow';
import { ROOM_CODES } from './warningCodes';
import { WarningsList } from './WarningsList';

const noop = (c: Parameters<Parameters<typeof MeasureField>[0]['apply']>[0]) => ({ config: c, rejected: null });
/** Room sizes start round: the sofa plus 3 ft each side and 8 ft in front, to the next foot. */
const roundUp = (x: number) => Math.ceil(x / 12) * 12;
const suggested = (l: Layout) => {
  const o = layoutBuiltOf(l).overall;
  return { w: roundUp(o.W + 72), d: roundUp(o.depth + 96) };
};
/** A typed width or length; the first one creates the room. */
const sizeOp = (key: 'w' | 'd') => (l: Layout, v: number) => setRoom(l, l.room ? { [key]: v } : { ...suggested(l), [key]: v });

export default function RoomPanel() {
  const store = useHavenStore();
  const live = useLiveLayout();
  const lb = layoutBuiltOf(live);
  const room = live.room;
  const fit = lb.room;
  const commit = (r: LayoutResult, key?: string) => {
    const s = store.getState();
    if (r.rejected) {
      s.toast(r.rejected.message);
      return false;
    }
    s.commitLayout(r.layout, key ? { key } : undefined);
  };
  const hint = suggested(live);

  return (
    <>
      <Section
        title="Room"
        aside={
          room && (
            <Button data-testid="remove-room" className="text-danger" onClick={() => commit(clearRoom(store.getState().layout))}>
              Remove
            </Button>
          )
        }
      >
        <MeasureField name="roomW" label="Room width" labelClass="w-28" value={room?.w ?? NaN} apply={noop} layoutOp={sizeOp('w')} readLayout={(l) => l.room?.w ?? NaN} placeholder={`e.g. ${hint.w}`} start={hint.w} />
        <MeasureField name="roomD" label="Room length" labelClass="w-28" value={room?.d ?? NaN} apply={noop} layoutOp={sizeOp('d')} readLayout={(l) => l.room?.d ?? NaN} placeholder={`e.g. ${hint.d}`} start={hint.d} />
        {!room && (
          <p className="text-[15px] text-ink" data-testid="room-hint">
            Type the room’s width or length to see the sofa in it.
          </p>
        )}
      </Section>
      {room && fit && (
        <>
          <Section title="Sofa position">
            <Segmented
              label="Sofa position"
              value={room.at.mode}
              options={[
                { value: 'center', label: 'Center' },
                { value: 'backWall', label: 'Back wall' },
                { value: 'free', label: 'Custom' },
              ]}
              onChange={(v) => {
                const l = store.getState().layout;
                // Custom keeps the sofa where it is now, and it stays there.
                commit(v === 'free' ? setRoomGap(l, 'left', layoutBuiltOf(l).room!.gaps.left) : placeRoom(l, v));
              }}
            />
            <RoomGapRow axis="across" gaps={fit.gaps} over={fit.sofa.w - fit.rect.w} />
            <RoomGapRow axis="along" gaps={fit.gaps} over={fit.sofa.h - fit.rect.h} />
          </Section>
          {lb.solo && (
            <Button data-testid="fill-width" onClick={() => commit(fillRoomWidth(store.getState().layout))}>
              Fill the width
            </Button>
          )}
          {/* "Sofa is 12″ wider than the room" is already on its row. */}
          <WarningsList only={ROOM_CODES.filter((c) => c !== 'roomTooBig')} />
        </>
      )}
    </>
  );
}
