// UX Phase 5 (Andre, 2026-11-11; the options A | B | C were dropped): Hide
// panel in the bar over the plan, so the plan or 3D fills the screen while
// Andre talks the client through it. Remembered on this device. Judged by
// outcome: the DOM, measured sizes, the plan's own scale.
import { config, labelCheck, panel } from './lib.mjs'
import { shot, smallText } from './phase3.mjs'

const LAPTOP = { width: 1440, height: 900 }
const LAPTOP_SMALL = { width: 1280, height: 800 }
const PORTRAIT = { width: 820, height: 1180 }
const U = '1UW188L132R132D44_bt32s36_la72_ra72.wh'
const U300 = '1UW300L132R132D44_bt32s74~s74_la72_ra72.fh'

async function fresh(context, base, path = `#c=${U}`) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-plan-svg]')
  await page.waitForTimeout(200)
  return { page, errors }
}
const svgBox = (page) => page.$eval('[data-plan-svg]', (e) => e.getBoundingClientRect().toJSON())
const planK = (page) => page.$eval('[data-plan-svg]', (e) => Number(e.dataset.k))
const toggle = (page) => page.getByTestId('panel-toggle')

export async function panelPhase(browser, base, check) {
  for (const [name, vp] of [['1440', LAPTOP], ['1280', LAPTOP_SMALL]]) {
    const context = await browser.newContext({ viewport: vp })
    const { page, errors } = await fresh(context, base)
    check((await page.$('aside.haven-side')) !== null && (await toggle(page).textContent()) === 'Hide panel »', `${name}: the panel shows by default, with "Hide panel »"`)
    const before = await svgBox(page)
    const k0 = await planK(page)
    await toggle(page).click()
    await page.waitForTimeout(300)
    const after = await svgBox(page)
    const k1 = await planK(page)
    check((await page.$('aside.haven-side')) === null && after.width > vp.width - 40 && after.width > before.width + 300, `${name}: Hide panel: no panel, the plan box ${Math.round(before.width)} → ${Math.round(after.width)} px wide`)
    // The Standard U is held by the window's height, so its scale may stay; it never shrinks.
    check(k1 <= k0, `${name}: the plan re-fits (${k0.toFixed(4)} → ${k1.toFixed(4)} in/px)`)
    const lc = await labelCheck(page)
    check(lc.overlaps === 0 && lc.clipped === 0, `${name}: ${lc.count} labels, ${lc.overlaps} overlapping, ${lc.clipped} clipped`)
    const small = await smallText(page)
    check(small.length === 0, `${name}: no text under 14 px (${small.join('; ')})`)
    if (name === '1440') await shot(browser, page, 'panel-hidden-1440')
    // Still editable with the panel hidden: a tap on a piece opens its menu; Undo works.
    const seat = (await config(page)).runs.back[1].id
    const r = await page.$eval(`[data-piece="${seat}"]`, (e) => e.getBoundingClientRect().toJSON())
    await page.mouse.click(r.left + r.width / 2, r.top + r.height / 2)
    await page.waitForSelector('[data-tap-menu]')
    check(true, `${name}: a tap on a piece opens its menu with the panel hidden`)
    await page.keyboard.press('Escape')
    // A reload keeps it hidden (this device); Show panel brings it back at the same width.
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    await page.waitForTimeout(200)
    check((await page.$('aside.haven-side')) === null && (await toggle(page).textContent()) === '« Show panel', `${name}: a reload keeps the panel hidden`)
    await toggle(page).click()
    await page.waitForTimeout(300)
    const back = await svgBox(page)
    check((await page.$('aside.haven-side')) !== null && Math.abs(back.width - before.width) < 2, `${name}: Show panel: the panel again, the plan ${Math.round(back.width)} px (was ${Math.round(before.width)})`)
    if (name === '1440') {
      await panel(page, 'Size')
      await shot(browser, page, 'panel-shown-1440')
      // 3D: the canvas takes the width too, and the sofa stays framed.
      await page.getByRole('radio', { name: '3D' }).click()
      await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
      await page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 30000, polling: 100 })
      const w0 = (await page.evaluate(() => window.__haven3d.state().size))[0]
      await toggle(page).click()
      // The 3D canvas follows its box after a short settle.
      await page.waitForFunction((w) => window.__haven3d.state().size[0] > w, w0, { timeout: 5000, polling: 100 }).catch(() => null)
      await page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 30000, polling: 100 })
      const w1 = (await page.evaluate(() => window.__haven3d.state().size))[0]
      check(w1 > w0 + 300, `3D: the canvas ${w0} → ${w1} px wide`)
      await shot(browser, page, 'panel-hidden-3d-1440')
      await toggle(page).click()
    }
    check(errors.length === 0, `${name}: no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // A wide sofa (held by the width): hiding the panel makes the plan bigger.
  {
    const context = await browser.newContext({ viewport: LAPTOP })
    const { page } = await fresh(context, base, `#c=${U300}`)
    if ((await page.$('aside.haven-side')) === null) await toggle(page).click() // this device remembers: show it first
    await page.waitForTimeout(250)
    const k0 = await planK(page)
    await toggle(page).click()
    await page.waitForTimeout(300)
    const k1 = await planK(page)
    check(k1 < k0, `a 300″ U: hiding the panel draws the plan bigger (${k0.toFixed(4)} → ${k1.toFixed(4)} in/px)`)
    await toggle(page).click()
    await context.close()
  }

  // iPad portrait: the panel sits under the plan; hiding it gives the plan the full height.
  {
    const context = await browser.newContext({ viewport: PORTRAIT })
    const { page, errors } = await fresh(context, base)
    const h0 = (await svgBox(page)).height
    await toggle(page).click()
    await page.waitForTimeout(300)
    const h1 = (await svgBox(page)).height
    check(h1 > h0 + 300, `portrait: the plan ${Math.round(h0)} → ${Math.round(h1)} px tall`)
    await toggle(page).click()
    check(errors.length === 0, `portrait: no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // ?view (view only): no toggle; its summary stays.
  {
    const context = await browser.newContext({ viewport: LAPTOP })
    const { page } = await fresh(context, base, `?view#c=${U}`)
    check((await toggle(page).count()) === 0 && (await page.$('aside.haven-side')) !== null, '?view: no Hide panel; the summary stays')
    await context.close()
  }
}
