// HTML height overlay (plan §7.2): in Front and Side, height ticks at 1 / 18 /
// 23 / 27 / 31″ (leg, seat, arm, back frame, back cushions) from
// BuildResult.heights; a tick closer than 12 px to the one below it is left
// out. Projected through the live camera, so it is exact. The scale bar is gone
// from the live 3D (Phase 3b, Andre 2026-11-08: it read as a "4 ft" tag). In
// Top, the numbered seat markers (Andre, 2026-11-09), the same as the plan's.
import { useSyncExternalStore } from 'react';
import { BACK_CUSHION, type HavenDims } from '@/engine';
import { isElevation, type PresetName } from '@/ortho/presets';
import type { ViewStore } from './viewStore';

export function Overlay({ view, preset, heights, markers }: { view: ViewStore; preset: PresetName; heights: HavenDims; markers: [number, number, number][] | null }) {
  const s = useSyncExternalStore(view.subscribe, view.get);
  if (!s) return null;
  if (markers?.length) return <SeatMarkers points={markers.map(s.project)} />;
  if (!isElevation(preset)) return null;
  const all = [
    { h: heights.legHeight, label: 'leg' },
    { h: heights.seatHeight, label: 'seat' },
    { h: heights.armHeight, label: 'arm' },
    { h: heights.backHeight, label: 'back' },
    { h: heights.backHeight + BACK_CUSHION.rise, label: 'cushions' },
  ];
  const ticks: typeof all = [];
  for (const t of all) {
    const last = ticks[ticks.length - 1];
    if (!last || Math.abs(s.heightY(last.h) - s.heightY(t.h)) >= 12) ticks.push(t);
  }
  const x = Math.max(4, s.leftX - 60);
  return (
    <div className="pointer-events-none absolute inset-0 text-sm font-semibold text-[#1c1b19]" data-testid="scale-overlay">
      {ticks.length > 0 && (
        <div className="absolute" style={{ left: x, top: 0 }} data-testid="height-ticks">
          <div className="absolute w-14 border-t border-[#3d3a35]" style={{ top: s.heightY(0) }} data-h={0} />
          {ticks.map((t) => (
            <div key={t.label} className="absolute flex w-14 items-center justify-end gap-1" style={{ top: s.heightY(t.h), transform: 'translateY(-50%)' }} data-h={t.h}>
              <span>{t.h}″</span>
              <span className="block h-px w-3 bg-[#3d3a35]" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The seat markers over the 3D Top view: the plan's circles, numbered in the same order. */
function SeatMarkers({ points }: { points: [number, number][] }) {
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="seat-markers-3d">
      {points.map(([x, y], i) => (
        <span
          key={i}
          data-marker={i + 1}
          className="absolute flex h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-[#1c1b19] bg-white text-sm font-bold text-[#1c1b19] tabular-nums"
          style={{ left: x, top: y }}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}
