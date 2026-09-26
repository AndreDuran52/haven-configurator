// Regression checks for the H3 walk-through bugs (2026-09-26): each one was
// found by using the app like a client session would.
import { VIEWPORTS } from './browser.mjs'
import { config, openApp, setField } from './lib.mjs'

const W300 = '1UW300L132R132D44_bt32s74~s74_la72_ra72.fh'

export async function fixes(browser, base, check) {
  const undoEnabled = (page) => page.getByRole('button', { name: 'Undo' }).isEnabled()
  const draftLive = (page) => page.evaluate(() => window.__haven.getState().draft !== null)

  // 1. Escape in a measurement field cancels (no commit, no undo step).
  {
    const { context, page } = await openApp(browser, base)
    const input = page.locator('#m-W')
    await input.click()
    await input.fill('250')
    await page.waitForTimeout(200)
    await input.press('Escape')
    await page.waitForTimeout(100)
    const c = await config(page)
    check(c.W === 188 && !(await undoEnabled(page)) && (await input.inputValue()) === '188', `Escape cancels a typed W (W ${c.W})`)
    // 6. A refusal names the measurement it needs, and clears once the field changes.
    await setField(page, 'W', 150)
    await setField(page, 'D', 36)
    await setField(page, 'W', 150)
    await setField(page, 'D', 44)
    const err = await page.textContent('[data-error=D]').catch(() => null)
    check(/W/.test(err ?? ''), `D = 44 at W 150 says which size it needs ("${err}")`)
    await setField(page, 'D', 40)
    check(!(await page.$('[data-error=D]')), 'the D error clears once D changes')
    await context.close()
  }

  // 2. The wedge slider never leaves a draft behind (Undo stays usable).
  {
    const { context, page } = await openApp(browser, base)
    const thumb = page.getByRole('slider')
    await thumb.focus()
    await thumb.press('ArrowRight')
    await thumb.press('ArrowRight')
    await page.waitForTimeout(100)
    check(!(await draftLive(page)) && (await undoEnabled(page)) && (await config(page)).wedgeC === 62, 'wedge arrow keys: committed, no draft left, Undo enabled')
    const b = await thumb.boundingBox()
    const [x, y] = [b.x + b.width / 2, b.y + b.height / 2]
    const before = await page.evaluate(() => window.__haven.getState().past.length)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 60, y, { steps: 6 })
    await page.mouse.move(x, y, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(100)
    const after = await page.evaluate(() => window.__haven.getState().past.length)
    check(!(await draftLive(page)) && after === before && (await undoEnabled(page)), 'wedge drag away and back: nothing committed, no draft left')
    const cdp = await context.newCDPSession(page)
    const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
    await t('touchStart', [{ x, y, id: 1 }])
    for (let i = 1; i <= 6; i++) await t('touchMove', [{ x: x - i * 10, y, id: 1 }])
    await t('touchCancel', [])
    await page.waitForTimeout(100)
    const shown = await page.textContent('[data-testid=wedge-readout]')
    check(!(await draftLive(page)) && /62 × 62/.test(shown), `wedge touchCancel: no draft left, readout back to the committed wedge ("${shown}")`)
    await context.close()
  }

  // 3. Opening the app never overwrites the "Resume last layout" draft.
  {
    const init = `localStorage.setItem('haven:draft', JSON.stringify({ code: '${W300}', savedAt: 1 }))`
    const { context, page } = await openApp(browser, base, '', VIEWPORTS.ipadLandscape, init)
    await page.waitForTimeout(1400)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('haven:draft')).code)
    check(stored === W300, `opening the app keeps yesterday's draft (${stored.slice(0, 12)}…)`)
    await context.close()
  }

  // 4. A malformed %-escape in a link shows "damaged", not a blank page. 5. The URL keeps the current layout.
  {
    const { context, page, errors } = await openApp(browser, base, '#c=abc%')
    const toast = await page.textContent('[data-testid=toast]').catch(() => '')
    check(/damaged/.test(toast) && errors.length === 0, `#c=abc% opens the Standard U with "${toast}" (${errors.length} errors)`)
    await page.getByRole('radio', { name: 'L right' }).click()
    await page.waitForTimeout(400)
    await page.evaluate(() => (location.hash = '#c=%ZZ'))
    await page.waitForTimeout(400)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    check((await config(page)).shape === 'L-right', 'after a damaged pasted link, a reload keeps the layout')
    await context.close()
  }

  // 7. Phones: the 3D preset bar is one row and doesn't cover the 3D view.
  {
    const { context, page } = await openApp(browser, base, '', VIEWPORTS.phone)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForSelector('[data-testid=presets]')
    await page.waitForSelector('canvas')
    const r = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid=presets]').getBoundingClientRect()
      const canvas = document.querySelector('canvas').getBoundingClientRect()
      const seats = document.querySelector('[data-testid=seats]').getBoundingClientRect()
      return { barBottom: bar.bottom, canvasTop: canvas.top, seatsH: seats.height }
    })
    check(r.barBottom <= r.canvasTop + 0.5, `phone: preset bar ends at ${r.barBottom.toFixed(1)} px, above the 3D view (${r.canvasTop.toFixed(1)} px)`)
    await setField(page, 'W', 300)
    const h = await page.evaluate(() => document.querySelector('[data-testid=seats]').getBoundingClientRect().height)
    check(h < 40, `phone: the seats chip stays on one line (${h.toFixed(0)} px)`)
    await context.close()
  }
}
