import { it } from 'vitest';
import { buildHaven } from './buildHaven';
import { standardU, standardL, blankConfig } from './defaults';
import * as op from './index';
it('dump', () => {
  const U = standardU();
  const tid = U.runs.back![0]!.id; const lid = U.runs.left![0]!.id;
  const cases: [string, any][] = [
    ['T1', U], ['T2', op.setMeasurements(U, { D: 36 })],
    ['T3a', op.moveTable(U, tid, { run: 'left', at: 'replaceArm' })],
    ['T3b', op.moveTable(U, tid, { run: 'left', at: 'split', pieceId: lid })],
    ['T4', standardL('right', { W: 120, R: 100 })], ['T5', op.setMeasurements(U, { W: 300 })],
    ['T6', op.setWedge(U, 55)], ['T7', op.setEndCap(U, 'right', 'open')], ['T8', blankConfig('U')],
    ['W140', op.setMeasurements(U, { W: 140 })],
  ];
  for (const [n, c] of cases) { const b = buildHaven(c); console.log(n, b.seats.label, JSON.stringify(b.opening), b.wedge.face.toFixed(1), b.warnings.map(w=>w.code).join(','), b.exportBlocked, c===U && n!=='T1' ? 'SAME-REF' : ''); }
  // round trip 3b -> back to back seam
  const c3 = op.moveTable(U, tid, { run: 'left', at: 'split', pieceId: lid });
  const back = op.moveTable(c3, tid, { run: 'back', at: 'seam', seam: 0 });
  console.log('roundtrip left', JSON.stringify(back.runs.left!.map(p=>[p.kind,p.length])), 'back', JSON.stringify(back.runs.back!.map(p=>[p.kind,p.length])));
  // coffee
  const cc = op.addLoose(U, 'coffeeTable'); console.log('clear', JSON.stringify(buildHaven(cc).clearances));
});
