// Phase 3b: the plan's pillows, loaded on first use so the pillow geometry
// stays out of the entry chunk. Returns a lookup per built section (cached by
// BuildResult, so a drag frame never recomputes them), or null while the
// Pillows switch is off or the module is still loading.
import { useEffect, useState } from 'react';
import type { BuildResult } from '@/engine';
import type { PlanPillow } from './pillowShapes';

type Of = (b: BuildResult) => PlanPillow[];
let loaded: Of | null = null;
const cache = new WeakMap<BuildResult, PlanPillow[]>();

export function usePlanPillows(on: boolean): Of | null {
  const [fn, setFn] = useState<Of | null>(() => loaded);
  useEffect(() => {
    if (!on || fn) return;
    let live = true;
    void import('./pillowShapes').then((m) => {
      loaded = (b) => {
        const hit = cache.get(b);
        if (hit) return hit;
        const p = m.planPillows(b);
        cache.set(b, p);
        return p;
      };
      if (live) setFn(() => loaded);
    });
    return () => {
      live = false;
    };
  }, [on, fn]);
  return on ? fn : null;
}
