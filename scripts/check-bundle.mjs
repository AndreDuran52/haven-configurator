// Entry-chunk budget (plan §3). Run after `vite build`.
// "Entry JS" = every JS file dist/index.html loads eagerly (entry script +
// modulepreloads). Fails if that exceeds the budget, or if three.js or jsPDF
// leaked into it (both must stay behind lazy()/import()).
// At the end of H2 tighten the budget to the measured entry + 15 %, rounded up.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BUDGET = { rawKb: 350, gzipKb: 110 }
const MARKERS = [
  { name: 'three.js', text: 'THREE.WebGLRenderer' },
  { name: 'jsPDF', text: 'jsPDF' },
]

const html = readFileSync('dist/index.html', 'utf8')
const eager = [...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]))]
if (eager.length === 0) {
  console.error('check:bundle: no entry JS found in dist/index.html (did the build run?)')
  process.exit(1)
}

let raw = 0
let gzip = 0
const problems = []
for (const file of eager) {
  const buf = readFileSync(`dist/${file}`)
  raw += buf.length
  gzip += gzipSync(buf, { level: 9 }).length
  const text = buf.toString('utf8')
  for (const m of MARKERS) {
    if (text.includes(m.text)) problems.push(`${m.name} leaked into the entry: ${file} contains "${m.text}"`)
  }
}

const rawKb = raw / 1000
const gzipKb = gzip / 1000
if (rawKb > BUDGET.rawKb) problems.push(`entry JS is ${rawKb.toFixed(1)} kB raw (budget ${BUDGET.rawKb} kB)`)
if (gzipKb > BUDGET.gzipKb) problems.push(`entry JS is ${gzipKb.toFixed(1)} kB gzip (budget ${BUDGET.gzipKb} kB)`)

const summary = `entry JS ${rawKb.toFixed(1)} kB raw / ${gzipKb.toFixed(1)} kB gzip across ${eager.length} file(s) (budget ${BUDGET.rawKb} / ${BUDGET.gzipKb} kB)`
if (problems.length) {
  for (const p of problems) console.error(`check:bundle: ${p}`)
  console.error(summary)
  process.exit(1)
}
console.log(`ok: ${summary}; no three.js or jsPDF markers`)
