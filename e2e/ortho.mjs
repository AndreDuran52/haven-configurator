// H3 done-when checks (plan §10, V2/V3/V5/V6/V9), judged by outcome: pixels of
// silhouette captures, projections, camera state, network timing.
import { VIEWPORTS } from './browser.mjs'
import { openApp, setField } from './lib.mjs'

const SHOTS = 'test-results'
const D2R = Math.PI / 180

async function settle(page) {
  await page.waitForTimeout(200)
  await page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 20000, polling: 100 })
  await page.waitForTimeout(150)
}

async function open3d(browser, base, viewport = VIEWPORTS.ipadLandscape, hash = '') {
  const app = await openApp(browser, base, hash, viewport)
  await app.page.getByRole('radio', { name: '3D' }).click()
  await app.page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
  await app.page.waitForTimeout(600) // hand-off: Top at plan scale, then the tween to 3/4
  await settle(app.page)
  return app
}

async function preset(page, name) {
  await page.locator(`[data-preset=${name}]`).click()
  await settle(page)
}

/** Dark-pixel mask of a silhouette capture, measured in the page. */
function silhouetteStats(page, opts, columns = []) {
  return page.evaluate(
    async ({ opts, columns }) => {
      const api = window.__haven3d
      const [w, h] = api.state().size
      const img = new Image()
      img.src = api.capture({ silhouette: true, ...opts })
      await img.decode()
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0, w, h)
      const d = g.getImageData(0, 0, w, h).data
      const dark = (x, y) => d[(y * w + x) * 4] < 128
      const tops = columns.map((x) => {
        const cx = Math.round(x)
        for (let y = 0; y < h; y++) if (dark(cx, y)) return y
        return null
      })
      return { w, h, tops }
    },
    { opts, columns },
  )
}

export async function ortho(browser, base, check) {
  // 1. The 3D chunk: not modulepreloaded, fetched only after first paint (warm-up).
  {
    const { context, page } = await openApp(browser, base)
    await page.waitForTimeout(2500)
    const t = await page.evaluate(async () => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
      const chunk = performance.getEntriesByType('resource').find((e) => /ThreeView-.*\.js$/.test(e.name))
      // the served index.html (Vite adds a modulepreload at runtime, when the warm-up imports it)
      const html = await (await fetch('/', { cache: 'no-store' })).text()
      return { fcp, chunk: chunk?.startTime ?? null, preloaded: /ThreeView/.test(html) }
    })
    check(!t.preloaded && t.chunk !== null && t.chunk > t.fcp, `3D chunk not modulepreloaded; fetched at ${t.chunk?.toFixed(0)} ms, after first paint at ${t.fcp.toFixed(0)} ms`)
    await context.close()
  }

  // 2. Top in parity mode overlays the SVG plan: IoU >= 0.999.
  for (const [vName, vp] of Object.entries(VIEWPORTS)) {
    const { context, page } = await openApp(browser, base, '', vp)
    const polys = await page.$$eval('[data-plan-svg] [data-piece] > polygon:first-child', (els) => els.map((e) => e.getAttribute('points')))
    const fit = await page.evaluate(() => window.__haven.getState().ui.planFit)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    const first = await page.evaluate(() => window.__haven3d.state())
    check(first.polarDeg < 0.01 && Math.abs(first.zoom - fit.S) < 1e-9, `${vName}: first switch opens Top at the plan's scale (${first.zoom.toFixed(4)} = ${fit.S.toFixed(4)} px/in)`)
    await page.waitForTimeout(600)
    await settle(page)
    const settled = await page.evaluate(() => window.__haven3d.state().preset)
    check(settled === 'threeQuarter', `${vName}: then tweens to the 3/4 view`)
    const r = await page.evaluate(
      async ({ fit, polys }) => {
        const api = window.__haven3d
        api.setTopAt(fit.S, fit.cx, fit.cy)
        const [w, h] = api.state().size
        const img = new Image()
        img.src = api.capture({ silhouette: true })
        await img.decode()
        const mask = (draw) => {
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const g = c.getContext('2d')
          g.fillStyle = '#fff'
          g.fillRect(0, 0, w, h)
          draw(g)
          const d = g.getImageData(0, 0, w, h).data
          const m = new Uint8Array(w * h)
          for (let i = 0; i < m.length; i++) m[i] = d[i * 4] < 128 ? 1 : 0
          return m
        }
        const a = mask((g) => g.drawImage(img, 0, 0, w, h))
        const b = mask((g) => {
          g.fillStyle = '#000'
          for (const p of polys) {
            const pts = p.split(' ').map((s) => s.split(',').map(Number))
            g.beginPath()
            pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x - fit.cx) * fit.S + w / 2, (y - fit.cy) * fit.S + h / 2))
            g.closePath()
            g.fill()
          }
        })
        let inter = 0
        let uni = 0
        let xor = 0
        for (let i = 0; i < a.length; i++) {
          inter += a[i] & b[i]
          uni += a[i] | b[i]
          xor += a[i] ^ b[i]
        }
        return { iou: inter / uni, xor, perimPx: 2 * (188 + 132 + 132) * fit.S }
      },
      { fit, polys },
    )
    check(r.iou >= 0.999, `${vName}: Top parity IoU ${r.iou.toFixed(5)} (mean edge offset ${(r.xor / r.perimPx).toFixed(3)} px)`)
    await context.close()
  }

  // 3. Every preset frames the whole sofa (V3); angles (V9); E20b.
  for (const [vName, vp] of Object.entries(VIEWPORTS)) {
    const { context, page } = await open3d(browser, base, vp)
    for (const name of ['top', 'front', 'side', 'threeQuarter', 'iso']) {
      await preset(page, name)
      const r = await page.evaluate(() => {
        const api = window.__haven3d
        const s = api.state()
        const [w, h] = s.size
        const pad = Math.round(Math.min(64, Math.max(20, 0.06 * Math.min(w, h))))
        const px = api.project(api.points())
        const out = px.filter(([x, y]) => x < pad - 0.5 || x > w - pad + 0.5 || y < pad - 0.5 || y > h - pad + 0.5).length
        const outY = px.filter(([, y]) => y < pad - 0.5 || y > h - pad + 0.5).length
        return { out, outY, s }
      })
      const exempt = vp.width <= 480 && (name === 'front' || name === 'side')
      check(exempt ? r.outY === 0 : r.out === 0, `${vName} ${name}: whole sofa framed${exempt ? ' vertically (phone: 3 px/in, anchored left)' : ''} (${r.out} points outside)`)
      const want = { top: [0, 0], front: [0, 90], side: [90, 90], threeQuarter: [30, 60], iso: [45, 90 - 35.264389682754654] }[name]
      const dAz = Math.abs(r.s.azimuthDeg - want[0]) * D2R
      const dPol = Math.abs(r.s.polarDeg - want[1]) * D2R
      if (vName === 'ipadLandscape' && name !== 'top') check(dPol < 1e-6 && dAz < 1e-6, `V9 ${name}: azimuth ${r.s.azimuthDeg.toFixed(6)}°, polar ${r.s.polarDeg.toFixed(6)}°`)
      if (vName === 'ipadLandscape' && name === 'top') {
        const [back, front] = await page.evaluate(() => window.__haven3d.project([[0, 0, -66], [0, 0, 66]]))
        check(back[1] < front[1], 'E20b: Top at azimuth 0 puts the back at the top of the screen')
      }
      if (vName !== 'ipadPortrait' && (name === 'threeQuarter' || name === 'front' || name === 'top')) await page.screenshot({ path: `${SHOTS}/h3-${vName}-${name}.png` })
    }
    await context.close()
  }

  // 4. Elevations to scale (V9) and height ticks within ±1 px of the rendered edges.
  {
    const { context, page } = await open3d(browser, base)
    await preset(page, 'front')
    const geo = await page.evaluate(() => {
      const api = window.__haven3d
      const [ox, oz] = api.offset
      const s = api.state()
      const at = (x) => api.project([[x + ox, 0, 22 + oz]])[0][0]
      return { zoom: s.zoom, floorY: api.project([[s.target[0], 0, s.target[2]]])[0][1], cols: { back: at(110), arm: at(22), seatEnd: at(92.75), seatMid: at(110) } }
    })
    const frame = await silhouetteStats(page, { only: ':frame' }, [geo.cols.back])
    const arm = await silhouetteStats(page, { only: ':arm' }, [geo.cols.arm])
    const seat = await silhouetteStats(page, { only: 'p2:seat' }, [geo.cols.seatEnd, geo.cols.seatMid])
    const hPx = (top) => geo.floorY - top
    const near = (px, inches) => Math.abs(px - inches * geo.zoom) <= 1
    const seatEndIn = 16 + 2 * (1 - (((2 * 0.5) / 35.5 - 1) ** 2))
    check(near(hPx(frame.tops[0]), 27), `Front: back top ${(hPx(frame.tops[0]) / geo.zoom).toFixed(2)}″ = 27 × zoom ± 1 px`)
    check(near(hPx(arm.tops[0]), 23), `Front: arm ${(hPx(arm.tops[0]) / geo.zoom).toFixed(2)}″ = 23 × zoom ± 1 px`)
    check(near(hPx(seat.tops[0]), seatEndIn) && near(hPx(seat.tops[1]), 18), `Front: seat cushion ${(hPx(seat.tops[0]) / geo.zoom).toFixed(2)}″ at its end (16 + crown) and ${(hPx(seat.tops[1]) / geo.zoom).toFixed(2)}″ mid-span (18)`)
    const ticks = await page.$$eval('[data-testid=height-ticks] [data-h]', (els) => {
      const host = document.querySelector('[data-testid=three-view]').getBoundingClientRect()
      return els.map((e) => {
        const r = e.getBoundingClientRect()
        return { h: Number(e.dataset.h), y: (e.dataset.h === '0' ? r.top : r.top + r.height / 2) - host.top }
      })
    })
    const t27 = ticks.find((t) => t.h === 27)
    const t23 = ticks.find((t) => t.h === 23)
    check(!!t27 && Math.abs(t27.y - frame.tops[0]) <= 1 && !!t23 && Math.abs(t23.y - arm.tops[0]) <= 1, `height ticks: 27″ at ${t27?.y.toFixed(1)} vs edge ${frame.tops[0]}, 23″ at ${t23?.y.toFixed(1)} vs edge ${arm.tops[0]}`)
    const bar = await page.$eval('[data-testid=scale-bar]', (e) => ({ px: Number(e.dataset.px), inches: Number(e.dataset.inches) }))
    check(Math.abs(bar.px - bar.inches * geo.zoom) < 1e-6, `scale bar ${bar.inches}″ = ${bar.px.toFixed(1)} px at ${geo.zoom.toFixed(3)} px/in`)

    // 5. Idle renders 0 frames over 2 s (V6).
    const f0 = await page.evaluate(() => window.__haven3d.state().frames)
    await page.waitForTimeout(2000)
    const f1 = await page.evaluate(() => window.__haven3d.state().frames)
    check(f1 === f0, `idle: ${f1 - f0} frames rendered in 2 s`)

    // 6. A config edit in the plan (typing W) updates 3D.
    const before = await page.evaluate(() => window.__haven3d.fit('front').spanU)
    await setField(page, 'W', 300)
    await settle(page)
    const after = await page.evaluate(() => window.__haven3d.fit('front').spanU)
    check(Math.abs(after - before - 112) < 0.5, `typing W = 300 updates 3D (front span ${before.toFixed(1)} → ${after.toFixed(1)}″)`)
    await context.close()
  }

  // 7. Touch (V5): a pinch zooms the canvas, not the page; one finger orbits; on release it springs back (Q1).
  {
    const context = await browser.newContext({ viewport: VIEWPORTS.ipadPortrait, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    await page.goto(base)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.waitForTimeout(600)
    await settle(page)
    const box = await page.locator('[data-testid=three-view] canvas').boundingBox()
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const cdp = await context.newCDPSession(page)
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
    const s0 = await page.evaluate(() => window.__haven3d.state())
    const two = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }]
    await touch('touchStart', two(100))
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', two(100 + i * 20))
      await page.waitForTimeout(16)
    }
    await page.waitForTimeout(400)
    const during = await page.evaluate(() => ({ zoom: window.__haven3d.state().zoom, scale: visualViewport.scale }))
    await touch('touchEnd', [])
    await settle(page)
    const after = await page.evaluate(() => ({ zoom: window.__haven3d.state().zoom, scale: visualViewport.scale }))
    check(during.zoom > s0.zoom * 1.3 && during.scale === 1 && after.scale === 1, `pinch zooms the canvas (${s0.zoom.toFixed(2)} → ${during.zoom.toFixed(2)} px/in), page scale stays 1`)
    check(Math.abs(after.zoom - s0.zoom) < 1e-3, `spring-back: released pinch returns to the preset zoom (${after.zoom.toFixed(3)})`)
    await touch('touchStart', [{ x: cx, y: cy, id: 1 }])
    for (let i = 1; i <= 15; i++) {
      await touch('touchMove', [{ x: cx + i * 12, y: cy - i * 8, id: 1 }])
      await page.waitForTimeout(16)
    }
    await page.waitForTimeout(300)
    const orbit = await page.evaluate(() => window.__haven3d.state())
    await touch('touchEnd', [])
    await settle(page)
    const back = await page.evaluate(() => window.__haven3d.state())
    check(Math.abs(orbit.azimuthDeg - s0.azimuthDeg) > 10 && orbit.polarDeg <= 90 + 1e-9, `one finger orbits (azimuth ${s0.azimuthDeg.toFixed(1)}° → ${orbit.azimuthDeg.toFixed(1)}°, polar ≤ 90°)`)
    check(Math.abs(back.azimuthDeg - s0.azimuthDeg) < 1e-6 && Math.abs(back.polarDeg - s0.polarDeg) < 1e-6, `spring-back: released orbit returns to the 3/4 preset (${back.azimuthDeg.toFixed(4)}°, ${back.polarDeg.toFixed(4)}°)`)
    await context.close()
  }

  // 8. Offline: after one online load, switching to 3D still works (service worker).
  {
    const { context, page } = await openApp(browser, base)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await page.waitForSelector('[data-plan-svg]')
    await page.waitForTimeout(2500) // the warm-up and precache
    await context.setOffline(true)
    await page.reload()
    await page.waitForSelector('[data-plan-svg]')
    await page.getByRole('radio', { name: '3D' }).click()
    const ok = await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 15000 }).then(() => true, () => false)
    check(ok, 'offline: switching to 3D works after one online load')
    await context.close()
  }
}
