// Seam handles (plan §8): 44 pt grips 14 px outside the seat front, always
// visible. The pointer side is handled by usePlanGestures (hit-testing, not the
// DOM); each grip is also a keyboard slider: arrows ±0.5″, Shift ±6″,
// coalesced by key within 800 ms (one undo step per burst).
import { dragSeam, type BuildResult } from '@/engine';
import { useHavenStore } from '@/state/store';
import { GRIP_R, type Grip } from './hitTest';

const BLUE = '#2f6fed';

export function GripsLayer({ grips, built, k }: { grips: Grip[]; built: BuildResult; k: number }) {
  const store = useHavenStore();
  const onKeyDown = (g: Grip) => (e: React.KeyboardEvent) => {
    const dir = ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<string, number>)[e.key];
    if (!dir) return;
    e.preventDefault();
    const s = store.getState();
    const r = dragSeam(s.config, g.run, g.seam, dir * (e.shiftKey ? 6 : 0.5));
    s.commit(r.config, { key: `seam:${g.run}:${g.seam}` });
  };
  const lengthBefore = (g: Grip) => {
    const before = built.pieces.find((p) => p.run === g.run && p.index === g.seam - 1);
    return before?.length ?? built.gaps.find((q) => q.run === g.run && q.index === g.seam - 1)?.length ?? 0;
  };
  return (
    <g data-grips="">
      {grips.map((g) => {
        const [x, y] = g.pt;
        const x2 = g.axis === 'x' ? g.at : g.run === 'left' ? built.D : built.W - built.D;
        const y2 = g.axis === 'x' ? built.D : g.at;
        return (
          <g
            key={`${g.run}:${g.seam}`}
            data-grip={`${g.run}:${g.seam}`}
            tabIndex={0}
            role="slider"
            aria-label={`Seam ${g.seam} on the ${g.run} run`}
            aria-valuenow={lengthBefore(g)}
            aria-orientation={g.axis === 'x' ? 'horizontal' : 'vertical'}
            onKeyDown={onKeyDown(g)}
            className="plan-grip"
          >
            <line x1={g.axis === 'x' ? g.at : x} y1={g.axis === 'x' ? y : g.at} x2={x2} y2={y2} stroke={BLUE} strokeWidth={1.5 * k} />
            {/* invisible 44 pt target (hit-testing decides; this is for focus rings) */}
            <circle cx={x} cy={y} r={GRIP_R * k} fill="transparent" />
            <circle cx={x} cy={y} r={11 * k} fill="#fff" stroke={BLUE} strokeWidth={2 * k} />
            <path
              d={g.axis === 'x' ? `M${x - 5 * k} ${y}h${10 * k}` : `M${x} ${y - 5 * k}v${10 * k}`}
              stroke={BLUE}
              strokeWidth={2 * k}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
}
