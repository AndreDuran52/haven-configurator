// H5 done-when checks (plan §10 H5): pillows at the Q15 counts inside the
// frame in every preset, fabrics/finishes round-trip through the link, Sketch
// toggles the plan, the 3D chunk budget, no CDN requests, pillows offline.
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { VIEWPORTS } from './browser.mjs'
import { config, openApp } from './lib.mjs'

const SHOTS = 'test-results'

async function settle(page) {
  await page.waitForTimeout(200)
  await page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 20000, polling: 100 })
  await page.waitForTimeout(150)
}

/** Dark pixels in a silhouette capture of the meshes whose names contain `only`. */
const inked = (page, only) =>
  page.evaluate(async (only) => {
    const api = window.__haven3d
    const [w, h] = api.state().size
    const img = new Image()
    img.src = api.capture({ silhouette: true, only })
    await img.decode()
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, w, h)
    const d = g.getImageData(0, 0, w, h).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++
    return n
  }, only)

export async function h5(browser, base, check) {
  // 1. Pillows: counts, framing in every preset at 3 viewports; no CDN requests.
  for (const [vName, vp] of Object.entries(VIEWPORTS)) {
    const { context, page, errors } = await openApp(browser, base, '', vp)
    const cdn = []
    page.on('request', (r) => /gstatic\.com|githack\.com/.test(r.url()) && cdn.push(r.url()))
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.waitForTimeout(700)
    await settle(page)
    const names = await page.evaluate(() => window.__haven3d.meshNames('pillow:'))
    const squares = names.filter((n) => n.includes(':sq')).length
    const balls = names.filter((n) => n.endsWith(':ball')).length
    if (vName === 'ipadLandscape') check(squares === 8 && balls === 4, `Standard U: 8 square + 4 ball pillows (2 + 1 at each wedge and arm end) (${squares} + ${balls})`)
    for (const name of ['top', 'front', 'side', 'threeQuarter', 'iso']) {
      await page.locator(`[data-preset=${name}]`).click()
      await settle(page)
      const r = await page.evaluate(() => {
        const api = window.__haven3d
        const [w, h] = api.state().size
        const pad = Math.round(Math.min(64, Math.max(20, 0.06 * Math.min(w, h))))
        const px = api.project(api.points())
        return {
          out: px.filter(([x, y]) => x < pad - 0.5 || x > w - pad + 0.5 || y < pad - 0.5 || y > h - pad + 0.5).length,
          outY: px.filter(([, y]) => y < pad - 0.5 || y > h - pad + 0.5).length,
        }
      })
      const exempt = vp.width <= 480 && (name === 'front' || name === 'side')
      check(exempt ? r.outY === 0 : r.out === 0, `${vName} ${name}: sofa and pillows framed${exempt ? ' vertically (phone elevation)' : ''} (${exempt ? r.outY : r.out} points outside)`)
      if (vName === 'ipadLandscape' && name !== 'top') check((await inked(page, 'pillow:')) > 200, `${name}: pillows render`)
      if (vName !== 'ipadPortrait' && (name === 'threeQuarter' || name === 'front')) await page.screenshot({ path: `${SHOTS}/h5-${vName}-${name}.png` })
    }
    // Pillows toggle off: gone from the scene and from the fit.
    if (vName === 'ipadLandscape') {
      const n0 = await page.evaluate(() => window.__haven3d.points().length)
      await page.getByRole('switch', { name: 'Pillows in 3D' }).click()
      await page.waitForTimeout(300)
      const n1 = await page.evaluate(() => window.__haven3d.points().length)
      const left = await page.evaluate(() => window.__haven3d.meshNames('pillow:').length)
      check(left === 0 && n1 === n0 - 12 * 8, `Pillows off: none drawn, 96 fit points fewer (${n0} → ${n1})`)
    }
    check(cdn.length === 0, `${vName}: no requests to gstatic.com or githack.com (${cdn.length})`)
    check(errors.length === 0, `${vName}: no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 2. Every fabric and finish: renders in 3D and round-trips through the link.
  {
    const { context, page } = await openApp(browser, base)
    const fabrics = await page.$$eval('[data-testid=fabrics] [role=radio]', (els) => els.map((e) => e.getAttribute('aria-label')))
    const finishes = await page.$$eval('[data-testid=finishes] [role=radio]', (els) => els.map((e) => e.getAttribute('aria-label')))
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await settle(page)
    for (const fab of fabrics) {
      for (const fin of finishes) {
        await page.locator('[data-testid=fabrics]').getByRole('radio', { name: fab }).click()
        await page.locator('[data-testid=finishes]').getByRole('radio', { name: fin }).click()
        await page.waitForTimeout(450)
        const c = await config(page)
        const hash = await page.evaluate(() => location.hash)
        const p2 = await context.newPage()
        await p2.goto(base + hash, { waitUntil: 'networkidle' })
        await p2.waitForSelector('[data-plan-svg]')
        const c2 = await config(p2)
        await p2.close()
        const wood = await inked(page, ':top')
        check(c2.fabric === c.fabric && c2.tableFinish === c.tableFinish && wood > 100, `${fab} + ${fin}: renders in 3D and round-trips through the link (${c.fabric}, ${c.tableFinish})`)
      }
    }
    await page.locator('[data-testid=finishes]').getByRole('radio', { name: 'Dark wood' }).click()
    await page.locator('[data-preset=iso]').click()
    await settle(page)
    await page.screenshot({ path: `${SHOTS}/h5-darkwood-iso.png` })
    await context.close()
  }

  // 3. Sketch toggles the plan: white fill, black lines, cushion seams.
  {
    const { context, page } = await openApp(browser, base)
    await page.getByRole('radio', { name: 'Sketch' }).click()
    await page.waitForTimeout(100)
    const r = await page.evaluate(() => {
      const svg = document.querySelector('[data-plan-svg]')
      const fills = [...svg.querySelectorAll('[data-piece] > polygon:first-child')].map((e) => e.getAttribute('fill'))
      return { look: svg.dataset.look, white: fills.every((f) => f === '#ffffff'), seams: svg.querySelectorAll('[data-seam]').length }
    })
    check(r.look === 'sketch' && r.white && r.seams === 3, `Sketch: white fills, black lines, a seam round each of the 3 seat cushions (${r.seams})`)
    await page.screenshot({ path: `${SHOTS}/h5-sketch.png` })
    await page.getByRole('radio', { name: 'CAD' }).click()
    check((await page.getAttribute('[data-plan-svg]', 'data-look')) === 'cad', 'CAD toggles back')
    await context.close()
  }

  // 4. The 3D chunk stays <= 300 kB gzip (no pillow or texture assets: all procedural).
  {
    const dir = 'dist/assets'
    const three = readdirSync(dir).filter((f) => /^ThreeView-.*\.js$/.test(f))
    const gz = three.reduce((s, f) => s + gzipSync(readFileSync(`${dir}/${f}`)).length, 0) / 1024
    const models = (() => {
      try {
        return readdirSync('dist/models').reduce((s, f) => s + statSync(`dist/models/${f}`).size, 0)
      } catch {
        return 0
      }
    })()
    check(gz <= 300 && models <= 1.5 * 1024 * 1024, `3D chunk ${gz.toFixed(1)} kB gzip (≤ 300), assets ${(models / 1024).toFixed(0)} kB (≤ 1.5 MB)`)
  }

  // 5. Pillows render offline after one online load.
  {
    const { context, page } = await openApp(browser, base)
    await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 20000 }).catch(() => {})
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.waitForTimeout(500)
    await context.setOffline(true)
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-plan-svg]')
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await settle(page)
    check((await inked(page, 'pillow:')) > 200, 'offline after one online load: pillows render')
    await context.close()
  }
}
