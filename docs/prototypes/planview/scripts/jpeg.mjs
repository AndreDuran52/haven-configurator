import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const srv = spawn('python3', ['-m', 'http.server', '5212', '--bind', '127.0.0.1'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 800))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true })
const page = await (await browser.newContext()).newPage()
await page.goto('http://127.0.0.1:5212/out/pdf/index.html')
await page.waitForFunction(() => window.__ready && window.makePdf)
for (const jpeg of [false, true, false, true]) {
  const r = await page.evaluate((j) => window.makePdf('standardU', 'client', { jpeg: j }), jpeg)
  if (jpeg) fs.writeFileSync('pdf/standardU-client-jpeg.pdf', Buffer.from(r.b64, 'base64'))
  const raw = Buffer.from(r.b64, 'base64').toString('latin1')
  console.log(jpeg ? 'JPEG q0.85' : 'PNG', r.ms + 'ms', (r.bytes / 1024).toFixed(0) + 'kB', 'DCTDecode:', /DCTDecode/.test(raw))
}
await browser.close(); srv.kill()
