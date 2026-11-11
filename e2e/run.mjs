// `npm run e2e`: serves the existing dist/ with Vite's preview server
// (in-process) and runs the browser checks against it. Run `npm run build` first.
import { preview } from 'vite'
import { launchBrowser } from './browser.mjs'
import { fixes } from './fixes.mjs'
import { fixes2 } from './fixes2.mjs'
import { seats } from './seats.mjs'
import { keep } from './keep.mjs'
import { panelPhase } from './panel.mjs'
import { sideView } from './side.mjs'
import { h2 } from './h2.mjs'
import { h4 } from './h4.mjs'
import { h5 } from './h5.mjs'
import { h6 } from './h6.mjs'
import { h6b } from './h6b.mjs'
import { phase1 } from './phase1.mjs'
import { phase3 } from './phase3.mjs'
import { phase3b } from './phase3b.mjs'
import { reporter } from './lib.mjs'
import { ortho } from './ortho.mjs'
import { shapes } from './shapes.mjs'
import { smoke } from './smoke.mjs'
import { room } from './room.mjs'
import { straight } from './straight.mjs'

const PORT = 4179
const BASE = `http://127.0.0.1:${PORT}/`

const { check, failures } = reporter()
const server = await preview({ preview: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
const browser = await launchBrowser()
try {
  await smoke(browser, BASE, check)
  await h2(browser, BASE, check)
  await ortho(browser, BASE, check)
  await fixes(browser, BASE, check)
  await h4(browser, BASE, check)
  await h5(browser, BASE, check)
  await h6(browser, BASE, check)
  await h6b(browser, BASE, check)
  await phase1(browser, BASE, check)
  await shapes(browser, BASE, check)
  await straight(browser, BASE, check)
  await room(browser, BASE, check)
  await phase3(browser, BASE, check)
  await phase3b(browser, BASE, check)
  await fixes2(browser, BASE, check)
  await seats(browser, BASE, check)
  await keep(browser, BASE, check)
  await panelPhase(browser, BASE, check)
  await sideView(browser, BASE, check)
} finally {
  await browser.close()
  await server.close()
}

if (failures.length) {
  console.error(`e2e: ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('e2e: all checks passed')
