import { blankConfig, standardL, standardU } from './engine/defaults'
import * as op from './engine/ops'
import type { Config } from './engine/types'

const tableId = (c: Config) => c.runs.back!.find((p) => p.kind === 'table')!.id

export function fixtures(): Record<string, Config> {
  const u = standardU()
  const t3b = op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: u.runs.left![0]!.id })
  // crowded: 3b plus a second table in the middle of the right leg, and a coffee table
  const crowded = op.addLoose(op.addPiece(t3b, 'table', { run: 'right', at: 'split', pieceId: t3b.runs.right![0]!.id }), 'coffeeTable')
  return {
    standardU: u,
    test3a: op.moveTable(u, tableId(u), { run: 'left', at: 'replaceArm' }),
    test3b: t3b,
    crowded,
    blankU: blankConfig('U', { W: 188, L: 132, R: 132 }),
    lRight: standardL('right', { W: 120, R: 100 }),
    lLeft: standardL('left'),
    w300: standardU({ W: 300 }),
    d36: standardU({ D: 36 }),
  }
}
