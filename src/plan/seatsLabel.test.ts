// The seat label moves off a loose piece sitting on its usual spot (QA 2026-11-06).
import { describe, expect, it } from 'vitest';
import { clearSeatsAt } from './seatsLabel';

describe('clearSeatsAt', () => {
  it('keeps its spot when nothing is in the way', () => {
    expect(clearSeatsAt([94, 80], [], 6, 7, 44, 132)).toEqual([94, 80]);
    expect(clearSeatsAt([94, 80], [{ x: 0, y: 0, w: 10, h: 10 }], 6, 7, 44, 132)).toEqual([94, 80]);
  });
  it('moves up or down the same column, clear of the piece and inside the opening', () => {
    const table = { x: 70, y: 60, w: 48, h: 48 };
    const [x, y] = clearSeatsAt([94, 80], [table], 6, 7, 44, 132);
    expect(x).toBe(94);
    expect(y - 6 * 0.8 >= table.y + table.h + 2 || y + 6 * 0.2 <= table.y - 2).toBe(true);
    expect(y).toBeGreaterThanOrEqual(50);
    expect(y).toBeLessThanOrEqual(132);
  });
});
