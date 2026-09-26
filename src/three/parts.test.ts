import { describe, expect, it } from 'vitest';
import { buildHaven, standardU } from '@/engine';
import { buildParts } from './parts';

describe('table style (Andre, 2026-09-26)', () => {
  const built = buildHaven(standardU());
  const tableParts = (style: 'standard' | 'allWood') =>
    buildParts(built, style).prisms.filter((p) => built.pieces.find((q) => q.id === p.pieceId)?.kind === 'table');

  it('standard: a 2″ wood top on a fabric base, 1–21–23', () => {
    const [base, top] = tableParts('standard');
    expect(base).toMatchObject({ mat: 'body', z0: 1, z1: 21 });
    expect(top).toMatchObject({ mat: 'wood', z0: 21, z1: 23 });
    expect(base!.poly).toEqual(top!.poly);
  });

  it('all wood: one solid wood block, 1–23', () => {
    const parts = tableParts('allWood');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ mat: 'wood', z0: 1, z1: 23 });
  });
});
