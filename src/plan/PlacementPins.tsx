// Tap-to-place (plan §8, primary on iPad): a "+" pin at every valid target for
// the tray piece; tapping one adds it there as one undoable commit.
import { useMemo } from 'react';
import { useHaven, useHavenStore } from '@/state/store';
import { isLooseTray, placementTargets, type TrayKind } from './placementTargets';
import { LIGHT } from './theme';

export function PlacementPins({ kind, k }: { kind: TrayKind; k: number }) {
  const store = useHavenStore();
  const config = useHaven((s) => s.config);
  const targets = useMemo(() => (isLooseTray(kind) ? [] : placementTargets(config, kind)), [config, kind]);
  return (
    <g data-pins="" data-count={targets.length}>
      {targets.map((t, i) => (
        <g
          key={i}
          data-pin={i}
          role="button"
          aria-label={`Place here (${t.placement.run} run)`}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            const s = store.getState();
            s.commit(t.config);
            s.setUi({ placing: null });
          }}
        >
          <circle cx={t.anchor[0]} cy={t.anchor[1]} r={22 * k} fill="transparent" />
          <circle cx={t.anchor[0]} cy={t.anchor[1]} r={15 * k} fill={LIGHT.select} stroke="#fff" strokeWidth={2 * k} />
          <path
            d={`M${t.anchor[0] - 7 * k} ${t.anchor[1]}h${14 * k}M${t.anchor[0]} ${t.anchor[1] - 7 * k}v${14 * k}`}
            stroke="#fff"
            strokeWidth={2.5 * k}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}
