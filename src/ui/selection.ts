// What the tap menu is about (plan §8): a seat, table, gap, loose piece or wedge.
import { type Config, type Rect, type RunId } from '@/engine';
import { fmtIn } from '@/plan/format';
import { builtOf } from '@/state/store';

export type Selection =
  | { type: 'seat' | 'table'; id: string; run: RunId; index: number; title: string; rect: Rect | null }
  | { type: 'gap'; id: string; run: RunId; index: number; title: string; rect: Rect | null }
  | { type: 'loose'; id: string; kind: 'ottoman' | 'coffeeTable'; title: string; rect: Rect | null }
  | { type: 'wedge'; id: string; title: string; rect: Rect | null };

export function selectionOf(c: Config, id: string | null): Selection | null {
  if (!id) return null;
  const b = builtOf(c);
  const p = b.pieces.find((q) => q.id === id);
  if (p?.kind === 'wedge') return { type: 'wedge', id, title: `Corner wedge · ${b.wedge.readout}`, rect: p.bbox };
  if (p?.kind === 'ottoman' || p?.kind === 'coffeeTable') {
    const name = p.kind === 'ottoman' ? 'Ottoman' : 'Coffee table';
    return { type: 'loose', id, kind: p.kind, title: `${name} · ${fmtIn(p.bbox.w, { mark: false })} × ${fmtIn(p.bbox.h)}`, rect: p.bbox };
  }
  for (const run of Object.keys(c.runs) as RunId[]) {
    const index = c.runs[run]!.findIndex((q) => q.id === id);
    if (index < 0) continue;
    const rp = c.runs[run]![index]!;
    if (rp.kind === 'gap') {
      const g = b.gaps.find((q) => q.run === run && q.index === index);
      return { type: 'gap', id, run, index, title: `Unfilled · ${fmtIn(rp.length)}`, rect: g?.rect ?? null };
    }
    if (!p) return null;
    if (rp.kind === 'table') return { type: 'table', id, run, index, title: `Table insert · ${fmtIn(rp.length)}`, rect: p.bbox };
    const A = c.dims.A;
    const title =
      rp.kind === 'oneArm'
        ? `One-arm seat · ${fmtIn(rp.length)} (${fmtIn(rp.length - A, { mark: false })} + ${fmtIn(A, { mark: false })} arm) · ${p.arm?.facing ?? ''}`
        : `Armless seat · ${fmtIn(rp.length)}`;
    return { type: 'seat', id, run, index, title, rect: p.bbox };
  }
  return null;
}

