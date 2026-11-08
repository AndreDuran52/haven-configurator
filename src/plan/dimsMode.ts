// UX Phase 3 (Andre, 2026-11-08): plan dimensions Overall | Detailed. Overall
// keeps the outside sizes and the depth callouts; Detailed adds every piece's
// chain (today's plan). The sheets always print Detailed.
import type { DimSource } from './dims';

export function withDimsMode(src: DimSource, mode: 'overall' | 'detailed'): DimSource {
  if (mode === 'detailed') return src;
  return { frame: src.frame, groups: (p) => src.groups(p).filter((g) => g.role !== 'chain') };
}
