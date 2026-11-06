// Freeform test fixtures (stage 3). Not exported from the engine index.
import { standardU } from './defaults';
import { toFree } from './freeConvert';
import type { FreeLayout, FreePiece, RootAt } from './freeTypes';
import { solo } from './layoutOps';

const shared = (): FreeLayout['shared'] => toFree(solo(standardU())).free!.shared;

export const freeOf = (pieces: FreePiece[], loose: FreeLayout['loose'] = []): FreeLayout => ({
  schema: 1,
  kind: 'free',
  shared: shared(),
  pieces,
  loose,
  nextId: pieces.length + loose.length + 1,
});

/** A straight sofa: one-arm 50 (arm left), armless 36 × n, one-arm 50 (arm right). 136″ for n = 1. */
export function straight(n = 1, at: RootAt = { x: 0, y: 0, rot: 0 }): FreeLayout {
  const ps: FreePiece[] = [{ id: 'p1', kind: 'oneArm', length: 50, arm: 'start', at }];
  for (let i = 0; i < n; i++) ps.push({ id: `p${i + 2}`, kind: 'armless', length: 36, at: { to: `p${i + 1}`, face: 'end' } });
  ps.push({ id: `p${n + 2}`, kind: 'oneArm', length: 50, arm: 'end', at: { to: `p${n + 1}`, face: 'end' } });
  return freeOf(ps);
}

/** A double-sided sofa: a straight 3-seat sofa with the same behind it, back to back. */
export function doubleSided(sharedBack: boolean): FreeLayout {
  const f = straight(1);
  const back: FreePiece[] = [
    { id: 'p4', kind: 'oneArm', length: 50, arm: 'start', at: { to: 'p3', face: 'back', offset: 0, sharedBack } },
    { id: 'p5', kind: 'armless', length: 36, at: { to: 'p4', face: 'end' } },
    { id: 'p6', kind: 'oneArm', length: 50, arm: 'end', at: { to: 'p5', face: 'end' } },
  ];
  return freeOf([...f.pieces, ...back]);
}

/** An L built from scratch: a wedge, a back row to the right and a leg down. */
export function freeL(): FreeLayout {
  return freeOf([
    { id: 'p1', kind: 'wedge', at: { x: 0, y: 0, rot: 0 } },
    { id: 'p2', kind: 'armless', length: 36, at: { to: 'p1', face: 'a' } },
    { id: 'p3', kind: 'oneArm', length: 50, arm: 'end', at: { to: 'p2', face: 'end' } },
    { id: 'p4', kind: 'oneArm', length: 72, arm: 'start', at: { to: 'p1', face: 'b' } },
  ]);
}

/** Two sofas facing each other across a coffee table: two groups. */
export function facing(): FreeLayout {
  const a = straight(1);
  // Turned 180°: its back at y 148, its front at y 104, 60″ from the first sofa's front.
  const b = straight(1, { x: 136, y: 44 + 60 + 44, rot: 180 });
  const bp = b.pieces.map((p) => ({ ...p, id: `q${p.id.slice(1)}`, at: 'to' in p.at ? { ...p.at, to: `q${p.at.to.slice(1)}` } : p.at }));
  return freeOf([...a.pieces, ...bp], [{ id: 'c1', kind: 'coffeeTable', x: 44, y: 50, w: 48, d: 48 }]);
}
