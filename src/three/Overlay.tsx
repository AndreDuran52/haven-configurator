// HTML scale overlay (plan §7.2): a scale bar in Top, Front, Side and Iso
// (× 0.8165 in Iso, "along length / depth / height only"), hidden in 3/4; in
// Front and Side, height ticks at 1 / 18 / 23 / 27″ from BuildResult.heights.
// Driven by camera.zoom, so it is exact.
import { useSyncExternalStore } from 'react';
import type { HavenDims } from '@/engine';
import { isElevation, type PresetName } from '@/ortho/presets';
import { ISO_AXIS_SCALE, scaleBar } from '@/ortho/scale';
import type { ViewStore } from './viewStore';

export function Overlay({ view, preset, heights }: { view: ViewStore; preset: PresetName; heights: HavenDims }) {
  const s = useSyncExternalStore(view.subscribe, view.get);
  if (!s || preset === 'threeQuarter') return null;
  const iso = preset === 'iso';
  const bar = scaleBar(s.zoom, iso ? ISO_AXIS_SCALE : 1);
  const ticks = isElevation(preset)
    ? [
        { h: heights.legHeight, label: 'leg' },
        { h: heights.seatHeight, label: 'seat' },
        { h: heights.armHeight, label: 'arm' },
        { h: heights.backHeight, label: 'back' },
      ]
    : [];
  const x = Math.max(4, s.leftX - 60);
  return (
    <div className="pointer-events-none absolute inset-0 text-[11px] font-semibold text-[#3d3a35]" data-testid="scale-overlay">
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
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-md bg-white/85 px-2 py-1.5" data-testid="scale-bar" data-px={bar.px} data-inches={bar.inches}>
        <div className="flex">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`block h-2 border border-[#3d3a35] ${i % 2 ? 'bg-white' : 'bg-[#3d3a35]'}`} style={{ width: bar.px / 4 }} />
          ))}
        </div>
        <span>
          {bar.label}
          {iso ? ' · along length / depth / height only' : ''}
        </span>
      </div>
    </div>
  );
}
