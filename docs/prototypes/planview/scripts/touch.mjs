import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
const srv = spawn('python3', ['-m', 'http.server', '5213', '--bind', '127.0.0.1'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 800))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
const logs = []
page.on('pageerror', (e) => logs.push('pageerror ' + e.message))
page.on('console', (m) => m.type() === 'error' && logs.push(m.text()))
await page.goto('http://127.0.0.1:5213/out/editor/index.html')
await page.waitForFunction(() => window.__plan && window.__store)
const cdp = await ctx.newCDPSession(page)
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 })) })
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const S = () => page.evaluate(() => { const s = window.__store.getState(); const r = (k) => (s.config.runs[k] ?? []).map((p) => `${p.kind} ${p.length}`); return { back: r('back'), left: r('left'), right: r('right'), past: s.past.length, future: s.future.length, draft: !!s.draft, sel: s.ui.selectedId, url: location.search } })
const out = {}
const k = await page.evaluate(() => window.__plan.k)
out.pxPerIn = +(1 / k).toFixed(3)
const grips = await page.evaluate(() => window.__plan.grips())
out.grips = grips
out.start = await S()

// 1. seam drag +40px, wandering OUTSIDE the svg (over the toolbar) mid-drag to prove capture
const g = grips.find((x) => x.run === 'back')
await touch('touchStart', [[g.x, g.y]])
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[g.x + i * 4, i === 5 ? 20 : g.y]]); await frame() }
const midShot = await page.screenshot({ path: 'shots/touch-mid-drag.png' })
out.readoutVisible = await page.evaluate(() => document.querySelector('[data-readout]')?.textContent ?? null)
await touch('touchEnd', [])
await frame()
out.afterSeamDrag = await S()
out.expectedDelta = Math.round((40 * k) * 2) / 2

// 2. undo via touch tap on the Undo button
const ub = await page.$('[data-undo]')
const bb = await ub.boundingBox()
await touch('touchStart', [[bb.x + bb.width / 2, bb.y + bb.height / 2]]); await touch('touchEnd', []); await frame()
out.afterUndo = await S()

// 3. table drag (test 3b): table centre (76,22) -> middle of left leg (22,96)
const [tx, ty] = await page.evaluate(() => window.__plan.toClient(76, 22))
const [lx, ly] = await page.evaluate(() => window.__plan.toClient(22, 96))
await page.evaluate(() => { window.__perf.moves = 0; window.__perf.computeMs = 0; window.__perf.builds = 0 })
await touch('touchStart', [[tx, ty]])
for (let i = 1; i <= 24; i++) { await touch('touchMove', [[tx + ((lx - tx) * i) / 24, ty + ((ly - ty) * i) / 24]]); await frame() }
await touch('touchEnd', []); await frame()
out.afterTableDrag = await S()
out.tablePerf = await page.evaluate(() => ({ moves: window.__perf.moves, avgMs: +(window.__perf.computeMs / window.__perf.moves).toFixed(3), candidateBuildsPerMove: window.__perf.builds / window.__perf.moves }))
await page.screenshot({ path: 'shots/touch-after-table.png' })

// 4. touchcancel mid seam drag: no trace
const g2 = (await page.evaluate(() => window.__plan.grips())).find((x) => x.run === 'left')
out.leftGrips = (await page.evaluate(() => window.__plan.grips())).filter((x) => x.run === 'left')
const before = await S()
await touch('touchStart', [[g2.x, g2.y]])
for (let i = 1; i <= 5; i++) { await touch('touchMove', [[g2.x, g2.y + i * 6]]); await frame() }
out.draftDuringDrag = (await S()).draft
await touch('touchCancel', []); await frame()
const after = await S()
const strip = ({ url, ...r }) => r
out.cancelLeavesNoTrace = JSON.stringify(strip(before)) === JSON.stringify(strip(after))
out.draftAfterCancel = after.draft

// 5. tap a seat -> selection (tap menu anchor)
const [sx, sy] = await page.evaluate(() => window.__plan.toClient(166, 110))
await touch('touchStart', [[sx, sy]]); await touch('touchEnd', []); await frame()
out.tapSelects = (await S()).sel

// 6. keyboard nudges on a focused grip coalesce into one step
const pastBefore = (await S()).past
out.focusedGrip = await page.evaluate(() => { const el = document.querySelector('[role=slider]'); el.focus(); return el.getAttribute('aria-label') })
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
out.keyboard = { ...(await S()), stepsAdded: (await S()).past - pastBefore }
console.log(JSON.stringify(out, null, 1))
if (logs.length) console.log(logs.join('\n'))
await browser.close(); srv.kill()
