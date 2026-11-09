// One direction of the sofa in the room (Andre, 2026-11-09): "Side to side
// ← Left 48″ · Right 50″ →" or "Front to back ↑ Back 48″ · Front 48″ ↓". The
// arrows move the sofa 1″ a click (hold to keep going, one Undo per hold);
// both numbers update together. A number can be typed: that gap is set and the
// other one follows. A sofa bigger than the room this way shows one plain line
// instead. Any arrow or typed gap makes the position Custom (engine/room.ts).
import { nudgeRoom, setRoomGap, type Nudge, type Wall } from '@/engine';
import { fmtIn } from '@/plan/format';
import { layoutBuiltOf, useHavenStore } from '@/state/store';
import { Stepper } from './Stepper';
import { useTypedValue } from './useTypedValue';

const Arrow = ({ turn }: { turn: number }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: `rotate(${turn}deg)` }}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

function GapInput({ wall, label, value }: { wall: Wall; label: string; value: number }) {
  const store = useHavenStore();
  const { error, input } = useTypedValue({
    value,
    committed: () => layoutBuiltOf(store.getState().layout).room?.gaps[wall] ?? NaN,
    run: (v) => {
      const s = store.getState();
      const r = setRoomGap(s.layout, wall, v);
      return { rejected: r.rejected, commit: () => (s.commitLayout(r.layout, { key: `gap:${wall}` }), null) };
    },
    message: (r) => r.rejected?.message ?? null,
  });
  return (
    <span className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-[15px] text-ink" htmlFor={`m-gap-${wall}`}>
        {label}
        <span className="relative">
          <input id={`m-gap-${wall}`} name={`gap-${wall}`} {...input} className="h-11 w-[58px] rounded-lg border border-line bg-panel px-2 pr-4 text-base tabular-nums" />
          <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-sm text-ink-muted">″</span>
        </span>
      </label>
      {error && (
        <span role="alert" className="text-sm font-medium text-danger" data-error={`gap-${wall}`}>
          {error}
        </span>
      )}
    </span>
  );
}

const AXES = {
  across: { title: 'Side to side', walls: ['left', 'right'], labels: ['Left', 'Right'], turns: [-90, 90], names: ['Move the sofa left', 'Move the sofa right'], big: 'wider' },
  along: { title: 'Front to back', walls: ['back', 'front'], labels: ['Back', 'Front'], turns: [0, 180], names: ['Move the sofa toward the back wall', 'Move the sofa toward the front'], big: 'deeper' },
} as const;

export function RoomGapRow({ axis, gaps, over }: { axis: keyof typeof AXES; gaps: Record<Wall, number>; over: number }) {
  const store = useHavenStore();
  const a = AXES[axis];
  const nudge = (dir: Nudge) => {
    const s = store.getState();
    const r = nudgeRoom(s.layout, dir);
    if (r.rejected) {
      s.toast(r.rejected.message);
      return false;
    }
    s.commitLayout(r.layout, { key: 'roomNudge' });
  };
  const move = (k: 0 | 1) => (
    <Stepper label={a.names[k]} onStep={() => nudge(a.walls[k])} testId={`nudge-${a.walls[k]}`}>
      <Arrow turn={a.turns[k]} />
    </Stepper>
  );
  return (
    <div className="flex flex-col gap-1.5" data-testid={`room-${axis}`}>
      <span className="text-sm font-semibold text-ink">{a.title}</span>
      {over > 0 ? (
        <p className="text-[15px] font-semibold text-warn-ink" data-testid={`room-too-big-${axis}`}>
          Sofa is {fmtIn(over, { mark: false })}″ {a.big} than the room
        </p>
      ) : (
        <div className="flex items-start gap-1.5">
          {move(0)}
          <GapInput wall={a.walls[0]} label={a.labels[0]} value={gaps[a.walls[0]]} />
          <span aria-hidden className="mt-2.5 text-ink-muted">·</span>
          <GapInput wall={a.walls[1]} label={a.labels[1]} value={gaps[a.walls[1]]} />
          {move(1)}
        </div>
      )}
    </div>
  );
}
