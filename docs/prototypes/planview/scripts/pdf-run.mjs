import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const srv = spawn('python3', ['-m', 'http.server', '5211', '--bind', '127.0.0.1'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 800))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true })
try {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 })).newPage()
  const logs = []
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
  await page.goto('http://127.0.0.1:5211/out/pdf/index.html')
  await page.waitForFunction(() => window.__ready && window.makePdf)
  const jobs = [
    ['standardU', 'client', { look: 'cad' }],
    ['standardU', 'shop', { look: 'cad' }],
    ['test3b', 'shop', { look: 'sketch' }],
    ['w300', 'shop', { look: 'cad' }],
    ['blankU', 'shop', { look: 'cad' }],
    ['standardU', 'client', { look: 'cad', embedFont: true }],
  ]
  fs.mkdirSync('pdf', { recursive: true })
  const res = []
  for (const [name, kind, opts] of jobs) {
    const r = await page.evaluate(([n, k, o]) => window.makePdf(n, k, o), [name, kind, opts])
    const file = `pdf/${name}-${kind}-${opts.look}${opts.embedFont ? '-ttf' : ''}.pdf`
    fs.writeFileSync(file, Buffer.from(r.b64, 'base64'))
    const raw = fs.readFileSync(file, 'latin1')
    res.push({ file, ms: r.ms, kB: +(r.bytes / 1024).toFixed(1), baseFonts: [...new Set(raw.match(/\/BaseFont \/[A-Za-z0-9+-]+/g) ?? [])], embeddedTTF: /\/FontFile2/.test(raw), printScalingNone: /\/PrintScaling \/None/.test(raw), images: (raw.match(/\/Subtype \/Image/g) ?? []).length })
  }
  const png = await page.evaluate(() => window.makePng('standardU', 200))
  fs.writeFileSync('pdf/standardU-client-200dpi.png', Buffer.from(png.b64, 'base64'))
  res.push({ png: 'pdf/standardU-client-200dpi.png', ms: png.ms, w: png.w, h: png.h, kB: +(Buffer.from(png.b64, 'base64').length / 1024).toFixed(1) })
  console.log(JSON.stringify(res, null, 1))
  // verify with pdf.js: page size, text, render
  const v = await page.context().newPage()
  await v.goto('http://127.0.0.1:5211/out/verify.html')
  await v.waitForFunction(() => window.__ready)
  for (const f of ['pdf/standardU-client-cad.pdf', 'pdf/standardU-shop-cad.pdf', 'pdf/test3b-shop-sketch.pdf', 'pdf/w300-shop-cad.pdf', 'pdf/blankU-shop-cad.pdf', 'pdf/standardU-client-cad-ttf.pdf']) {
    const info = await v.evaluate(([b64]) => window.inspect(b64, 1.6), [fs.readFileSync(f).toString('base64')])
    console.log(f, JSON.stringify({ pages: info.pages, sizes: info.sizes, fonts: [...new Set(info.fonts)], text: info.text.map((t) => t.slice(0, 420)) }))
    await v.screenshot({ path: f.replace('.pdf', '.png'), fullPage: true })
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'))
} finally {
  await browser.close()
  srv.kill()
}
