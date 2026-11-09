// The Room tab: where does it go? (H6c, Andre 2026-11-07; Phase 3b,
// 2026-11-08). No "Add" step: typing the room width or length creates the room
// (the other starts a little bigger than the sofa). Then Center · Back wall ·
// Custom, the four distances from the sofa to the walls (each typed), the move
// pad (1″ per tap, hold to repeat; one undo step per hold), Fill the width,
// Remove, and the room's warnings. Every action is one layout op. Loaded lazily.
import { clearRoom, fillRoomWidth, nudgeRoom, placeRoom, setRoom, setRoomGap, type Layout, type LayoutResult, type Nudge, type Wall } from '@/engine';
import { layoutBuiltOf, useHavenStore, useLiveLayout } from '@/state/store';
import { Button, Section, Segmented } from './controls';
import { MeasureField } from './MeasureField';
import { Stepper } from './Stepper';
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
const gapOf = (wall: Wall) => (l: Layout) => layoutBuiltOf(l).room?.gaps[wall] ?? NaN;

const WALLS: { wall: Wall; label: string }[] = [
  { wall: 'left', label: 'Left' },
  { wall: 'right', label: 'Right' },
  { wall: 'back', label: 'Back' },
  { wall: 'front', label: 'Front' },
];

const Arrow = ({ turn }: { turn: number }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: `rotate(${turn}deg)` }}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

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
  const nudge = (dir: Nudge) => commit(nudgeRoom(store.getState().layout, dir), 'roomNudge');
  const hint = suggested(live);
  const move = (dir: Nudge, turn: number, label: string) => (
    <Stepper label={label} onStep={() => nudge(dir)} testId={`nudge-${dir}`}>
      <Arrow turn={turn} />
    </Stepper>
  );

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
          <Section title="Sofa in the room">
            <Segmented
              label="Sofa in the room"
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
          </Section>
          <Section title="Distance to the walls">
            {WALLS.map(({ wall, label }) => (
              <MeasureField
                key={wall}
                name={`gap-${wall}`}
                label={label}
                labelClass="w-16"
                value={fit.gaps[wall]}
                apply={noop}
                layoutOp={(l, v) => setRoomGap(l, wall, v)}
                readLayout={gapOf(wall)}
              />
            ))}
            <div className="flex items-center gap-3">
              <span className="w-16 text-sm font-semibold">Move</span>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Move the sofa in the room" data-testid="move-pad">
                <span />
                {move('back', 0, 'Move the sofa toward the back wall')}
                <span />
                {move('left', -90, 'Move the sofa left')}
                {move('front', 180, 'Move the sofa toward the front')}
                {move('right', 90, 'Move the sofa right')}
              </div>
              <span className="text-sm text-ink-muted">1″ a tap, hold to keep going</span>
            </div>
          </Section>
          {lb.solo && (
            <Button data-testid="fill-width" onClick={() => commit(fillRoomWidth(store.getState().layout))}>
              Fill the width
            </Button>
          )}
          <WarningsList only={ROOM_CODES} />
        </>
      )}
    </>
  );
}
