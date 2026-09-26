// `npm run e2e`: serves the existing dist/ with Vite's preview server
// (in-process) and runs the browser checks against it. Run `npm run build` first.
import { preview } from 'vite'
import { launchBrowser } from './browser.mjs'
import { fixes } from './fixes.mjs'
import { h2 } from './h2.mjs'
import { h4 } from './h4.mjs'
import { reporter } from './lib.mjs'
import { ortho } from './ortho.mjs'
import { smoke } from './smoke.mjs'

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
} finally {
  await browser.close()
  await server.close()
}

if (failures.length) {
  console.error(`e2e: ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('e2e: all checks passed')
