// Fails if three.js reaches the JS that index.html loads eagerly (entry +
// modulepreloads), or if that entry JS grows past the budget. Run after build.
import { readFileSync, statSync } from 'node:fs'

const BUDGET_KB = 850
const html = readFileSync('dist/index.html', 'utf8')
const eager = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1])
const leaks = eager.filter((f) => readFileSync(`dist/${f}`, 'utf8').includes('THREE.WebGLRenderer'))
const kb = eager.reduce((sum, f) => sum + statSync(`dist/${f}`).size, 0) / 1000

if (leaks.length) {
  console.error(`three.js leaked into the eager bundle: ${leaks.join(', ')}`)
  process.exit(1)
}
if (kb > BUDGET_KB) {
  console.error(`eager JS is ${kb.toFixed(1)} kB (budget ${BUDGET_KB} kB)`)
  process.exit(1)
}
console.log(`ok: eager JS ${kb.toFixed(1)} kB across ${eager.length} file(s), no three.js`)
