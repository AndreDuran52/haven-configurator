// H6c (Andre, 2026-11-07): the client's room in the plan and on the sheet.
// `RoomFloor` goes under the sofa (the floor and its walls); `RoomGaps` over
// it: the distance from the sofa to each wall, amber under 30″ at the sides
// and front (a walkway), red past a wall. A gap of 0 (touching) is not drawn.
import { WALKWAY_MIN, type RoomFit, type Wall } from '@/engine';
import { fmtIn } from './format';
import type { PlanTheme } from './theme';

export function RoomFloor({ room, k, theme }: { room: RoomFit; k: number; theme: PlanTheme }) {
  const r = room.rect;
  return (
    <g data-room="" data-room-w={r.w} data-room-d={r.h}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={theme.floor} stroke={theme.wall} strokeWidth={+(3 * k).toFixed(4)} />
    </g>
  );
}

/**
 * `frontX`: where the front gap is measured (under the piece that reaches
 * farthest forward, e.g. a leg of a U).
 */
export function RoomGaps({ room, k, theme, frontX, size = 14 }: { room: RoomFit; k: number; theme: PlanTheme; frontX: number; size?: number }) {
  const r = room.rect;
  const s = room.sofa;
  const midY = s.y + s.h / 2;
  const midX = s.x + s.w / 2;
  const lines: { wall: Wall; a: [number, number]; b: [number, number] }[] = [
    { wall: 'left', a: [r.x, midY], b: [s.x, midY] },
    { wall: 'right', a: [s.x + s.w, midY], b: [r.x + r.w, midY] },
    { wall: 'back', a: [midX, r.y], b: [midX, s.y] },
    { wall: 'front', a: [frontX, s.y + s.h], b: [frontX, r.y + r.h] },
  ];
  const fs = +(size * k).toFixed(4);
  const lw = +(1 * k).toFixed(4);
  return (
    <g data-room-gaps="">
      {lines.map(({ wall, a, b }) => {
        const g = room.gaps[wall];
        if (g === 0) return null;
        const color = g < 0 ? theme.bad : wall !== 'back' && g < WALKWAY_MIN ? theme.warn : theme.dim;
        const vertical = a[0] === b[0];
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        return (
          <g key={wall} data-room-gap={wall} data-gap={g} data-short={(g < 0 || (wall !== 'back' && g < WALKWAY_MIN)) || undefined}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={lw} strokeDasharray={`${4 * k} ${3 * k}`} />
            <text
              data-dim-text=""
              x={vertical ? cx + fs * 0.4 : cx}
              y={vertical ? cy + fs * 0.35 : cy - fs * 0.4}
              fontSize={fs}
              fontFamily={theme.font}
              fontWeight={theme.bold}
              fill={color}
              textAnchor={vertical ? 'start' : 'middle'}
            >
              {g < 0 ? `−${fmtIn(-g)}` : fmtIn(g)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
