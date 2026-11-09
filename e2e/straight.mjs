// Straight sofa checks (Andre, 2026-11-06; plan §10 "Straight sofa"): start it
// from the Projects home, its plan (no corners, no legs, one depth callout), a
// table dropped between the seats (32″, both seats shrink; 2026-11-09), a table in place of the start
// arm from the tap menu, the v4 link in a fresh browser, 3D Top parity and the
// PDF header. Judged by outcome: the config, the link, the DOM, the PDF text.
import { VIEWPORTS } from './browser.mjs'
import { pdfText } from './h6.mjs'
import { config, dimTexts, labelCheck, panel } from './lib.mjs'
import { planShapes, topParityIoU } from './parity.mjs'

const SHOTS = 'test-results'
/** Andre's site photo: one-arm 63 | 33 | table 20 | 33 | one-arm 63 (golden v4). */
const PHOTO = '4iW212L44R44D44_ba63Ss33jt20s33ja63E.ud'

const centreOf = (page, sel) =>
  page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  })
const back = (c) => c.runs.back.map((p) => p.kind + p.length + (p.arm ? `@${p.arm}` : '')).join(' ')

async function fresh(browser, url, viewport = VIEWPORTS.ipadLandscape, scheme = 'light') {
  const context = await browser.newContext({ viewport, hasTouch: true, colorScheme: scheme })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(url, { waitUntil: 'networkidle' })
  return { context, page, errors }
}

export async function straight(browser, base, check) {
  // 1. From the Projects home: the standard straight sofa, its plan and panel.
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByTestId('new-straight').click()
    await page.waitForSelector('[data-plan-svg]')
    await page.waitForTimeout(200)
    const c = await config(page)
    check(c.shape === 'straight' && back(c) === 'oneArm60@start oneArm60@end', `"Straight sofa" starts W 120, one-arm 60 | 60, arms out (${back(c)})`)
    const texts = await dimTexts(page)
    check(texts.includes(`120" (10'-0")`) && texts.filter((t) => t === '44"D').length === 1, `plan dims: 120" (10'-0") once, 44"D once (${texts.join(', ')})`)
    check((await page.locator('[data-corners] > *').count()) === 0, 'no corner wedges drawn')
    check((await page.textContent('[data-testid=seats]')) === 'Seats 3', 'Seats 3')
    check((await page.getByRole('radio', { name: 'Straight' }).getAttribute('aria-checked')) === 'true', 'the shape picker shows Straight')
    check((await page.locator('#m-L, #m-R').count()) === 0 && (await page.getByText('Corner wedge').count()) === 0, 'the Size tab has no L, R or corner wedge')
    check((await page.evaluate(() => window.__plan.encode())).startsWith('4iW120'), 'its link is v4 (4i…)')
    // A table dragged from the tray to the seam between the two seats (Andre, 2026-11-09): 32″,
    // both seats give 16″: 14 | 30 | 32 | 30 | 14.
    await panel(page, 'Pieces')
    const touch = await context.newCDPSession(page)
    const send = (type, pts) => touch.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
    const chip = await centreOf(page, '[data-tray-item=table]')
    const seat = await page.$eval(`[data-piece="${c.runs.back[0].id}"]`, (e) => {
      const r = e.getBoundingClientRect()
      return [r.right, r.top + r.height / 2]
    })
    await send('touchStart', [{ x: chip[0], y: chip[1], id: 1 }])
    for (let i = 1; i <= 16; i++) {
      await send('touchMove', [{ x: chip[0] + ((seat[0] - chip[0]) * i) / 16, y: chip[1] + ((seat[1] - chip[1]) * i) / 16, id: 1 }])
      await page.waitForTimeout(20)
    }
    await send('touchEnd', [])
    await page.waitForTimeout(200)
    const t = await config(page)
    check(back(t) === 'oneArm44@start table32 oneArm44@end', `the tray table lands between the seats: 32″, seats 30 | 30 (${back(t)})`)
    // The start arm becomes a table from the tap menu (the end nearest the tapped seat).
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    const first = (await config(page)).runs.back[0].id
    await page.locator(`[data-piece="${first}"]`).click()
    await page.waitForSelector('[data-tap-menu]')
    await page.locator('[data-tap-menu]').getByRole('radio', { name: 'Table' }).click()
    const e = await config(page)
    check(back(e) === 'table32 armless28 oneArm60@end', `"End of this run: Table" on the left seat puts the table at the start (${back(e)})`)
    const lc = await labelCheck(page)
    check(lc.overlaps === 0 && lc.clipped === 0, `labels: ${lc.count}, ${lc.overlaps} overlapping, ${lc.clipped} clipped`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. Andre's site photo by link (v4) in a fresh browser: plan, 3D Top parity, PDF header and file name.
  {
    const { context, page, errors } = await fresh(browser, `${base}#c=${PHOTO}`)
    await page.waitForSelector('[data-plan-svg]')
    check((await page.evaluate(() => window.__plan.encode())) === PHOTO, 'the v4 link opens the same sofa and re-encodes byte for byte')
    const texts = await dimTexts(page)
    check(['14"', '49"', '33"', '20"'].every((x) => texts.includes(x)) && texts.includes(`212" (17'-8")`), `the chain reads 14 | 49 | 33 | 20 | 33 | 49 | 14 under 212" (17'-8")`)
    await page.screenshot({ path: `${SHOTS}/straight-photo-plan.png` })
    await page.mouse.click(5, 5)
    const shapes = await planShapes(page)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.waitForTimeout(900)
    const iou = await topParityIoU(page, shapes)
    check(iou >= 0.999, `3D Top matches the plan (IoU ${iou.toFixed(5)})`)
    await page.locator('[data-preset=threeQuarter]').click()
    await page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 90000, polling: 100 })
    await page.screenshot({ path: `${SHOTS}/straight-photo-3d.png` })
    await page.getByRole('radio', { name: 'Plan' }).click()
    await page.getByTestId('share').click()
    await page.waitForSelector('[data-testid=sheet-views]')
    await page.getByTestId('make-pdf').click()
    await page.waitForSelector('[data-testid=made]', { timeout: 60000 })
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
    const path = `${SHOTS}/straight.pdf`
    await dl.saveAs(path)
    const file = dl.suggestedFilename()
    check(/^Haven-Straight-212x44-\d{4}-\d\d-\d\d\.pdf$/.test(file), `file name ${file}`)
    const pdf = await pdfText(path)
    const header = pdf.items.find((i) => i.str.startsWith('Straight sofa'))?.str.replace(/\s+/g, ' ')
    check(header === `Straight sofa · 212" W · 44" deep · 17'-8" wide`, `PDF header "${header}"`)
    const spec = pdf.items.find((i) => i.str.includes('Seat depth'))?.str.replace(/\s+/g, ' ')
    check(!!spec?.includes('Seat depth 26"'), `the PDF shows the seat depth again: "${spec}"`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 3. Screenshots at three sizes (one light look since Phase 3b: no dark mode).
  for (const [vn, vp] of Object.entries(VIEWPORTS)) {
    for (const scheme of ['light']) {
      const { context, page } = await fresh(browser, `${base}#c=${PHOTO}`, vp, scheme)
      await page.waitForSelector('[data-plan-svg]')
      await page.waitForTimeout(200)
      const lc = await labelCheck(page)
      check(lc.overlaps === 0 && lc.clipped === 0, `${vn} ${scheme}: ${lc.count} labels, ${lc.overlaps} overlapping, ${lc.clipped} clipped`)
      await page.screenshot({ path: `${SHOTS}/straight-${vn}-${scheme}.png` })
      await context.close()
    }
  }
}
