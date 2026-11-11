import { describe, expect, it } from 'vitest';
import { buildHaven, decodeLayout, rootConfig } from '@/engine';
import { personFigure } from './person';
import { personPoints, personSeat } from './personSeat';

const built = (code: string) => {
  const d = decodeLayout(code);
  if (!('layout' in d)) throw new Error('bad link');
  return buildHaven(rootConfig(d.layout));
};

describe('where the 3D person sits (plan Q79)', () => {
  it('the middle of the back run\'s widest seat, from the sofa\'s back edge', () => {
    // Standard U with a 32″ table: the back run is a table (60–92) and one 36″ seat (92–128).
    const seat = personSeat(built('1UW188L132R132D44_bt32s36_la72_ra72.wh'));
    expect(seat).toEqual({ x: 110, back: 0 });
  });

  it('the widest of several seats', () => {
    const b = built('1UW300L132R132D44_bt32s74~s74_la72_ra72.fh');
    const seat = personSeat(b)!;
    const seats = b.runs.find((r) => r.id === 'back')!.pieceIds.map((id) => b.pieces.find((p) => p.id === id)!).filter((p) => p.cushionRect);
    const widest = Math.max(...seats.map((p) => p.cushionRect!.w));
    expect(seats.some((p) => p.cushionRect!.w === widest && p.cushionRect!.x + widest / 2 === seat.x)).toBe(true);
  });

  it('the fit points box the figure: from the seat back to the toes, up to the head', () => {
    const b = built('1UW188L132R132D44_bt32s36_la72_ra72.wh');
    const seat = personSeat(b)!;
    const fig = personFigure(69, 'upright', { seatHeight: 18, pillowFront: 18, D: 44 });
    const pts = personPoints(b, fig, seat);
    expect(pts).toHaveLength(8);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(fig.top, 5);
    const xs = pts.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(18); // shoulders and arms
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(26);
  });
});
