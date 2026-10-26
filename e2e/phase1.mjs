// UX Phase 1 checks (Andre, 2026-10-02): no partial commits while typing, no
// lost work (unreadable saved list, reload of an open project), Plan and 3D
// agree at 44 and 38 deep for every shape. Fresh browser contexts only: never
// Andre's data. Screenshots: iPad landscape/portrait, laptop, phone, light/dark.
import { VIEWPORTS } from './browser.mjs'
import { config, dimTexts, openApp } from './lib.mjs'
import { planShapes, topParityIoU } from './parity.mjs'

const SHOTS = 'test-results'
const LAPTOP = { width: 1440, height: 900 }

const draftLive = (page) => page.evaluate(() => window.__haven.getState().draft !== null)

export async function phase1(browser, base, check) {
  // 1. "Make it 38 inches deep": typing never moves the sofa; Enter commits once.
  {
    const { context, page } = await openApp(browser, base)
    const before = (await dimTexts(page)).slice(0, 4).join(' | ')
    const input = page.locator('#m-D')
    await input.click()
    await input.fill('')
    await input.type('3')
    await page.waitForTimeout(500)
    const mid = (await dimTexts(page)).slice(0, 4).join(' | ')
    await input.type('8')
    await page.waitForTimeout(500)
    const typed = (await dimTexts(page)).slice(0, 4).join(' | ')
    check(mid === before && typed === before && !(await draftLive(page)), `typing "3", pause, "8": the plan never changes (${typed})`)
    await input.press('Enter')
    await page.waitForTimeout(100)
    const t = await dimTexts(page)
    const c = await config(page)
    check(
      t.slice(0, 4).join(' | ') === '54" | 32" | 48" | 54"' && c.D === 38 && c.W === 188 && c.L === 132 && c.R === 132,
      `Enter: D 38, corners 54, back armless 48, W/L/R 188/132/132 (${t.slice(0, 4).join(' | ')})`,
    )
    check(t.filter((x) => x === '64"').length === 2, 'each leg one-arm 78 reads seat 64 | arm 14')
    await page.getByRole('button', { name: 'Undo' }).click()
    check((await config(page)).D === 44, 'one Undo brings 44 back')
    await context.close()
  }

  // 2. Plan and 3D agree (Top parity) for the Standard U and both Ls, at 44 and 38 deep.
  for (const shape of ['U', 'L left', 'L right']) {
    for (const D of [44, 38]) {
      const { context, page } = await openApp(browser, base)
      if (shape !== 'U') await page.getByRole('radio', { name: shape, exact: true }).click()
      if (D !== 44) {
        await page.locator('#m-D').fill(String(D))
        await page.locator('#m-D').press('Enter')
      }
      await page.waitForTimeout(150)
      await page.mouse.click(5, 5)
      const shapes = await planShapes(page)
      await page.getByRole('radio', { name: '3D' }).click()
      await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
      await page.waitForTimeout(900)
      const iou = await topParityIoU(page, shapes)
      check(iou >= 0.999, `${shape} at ${D}": Plan and 3D Top agree (IoU ${iou.toFixed(5)})`)
      await context.close()
    }
  }

  // 3. An unreadable saved list: copied aside, saving still works, the home warns.
  {
    const { context, page } = await openApp(browser, base)
    await page.evaluate(() => localStorage.setItem('haven:saved', '[{"id":"s1","name":"Mitchell","code":"1UW1'))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid=projects-home]')
    check(await page.getByTestId('recovered').isVisible(), 'the Projects home warns that the list could not be read')
    const copies = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('haven:saved:recovered-'))
        .map((k) => localStorage.getItem(k)),
    )
    check(copies.length === 1 && copies[0] === '[{"id":"s1","name":"Mitchell","code":"1UW1', 'the exact text is kept in a recovery copy')
    await page.screenshot({ path: `${SHOTS}/p1-recovered-home.png` })
    await page.getByTestId('new-standardU').click()
    await page.waitForSelector('[data-plan-svg]')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByTestId('save-name').fill('After')
    await page.getByTestId('save-confirm').click()
    await page.waitForTimeout(100)
    check((await page.locator('[role=alert]').count()) === 0, 'saving is not blocked')
    await page.getByTestId('projects').click()
    check((await page.locator('[data-saved]').count()) === 1 && (await page.getByTestId('recovered').isVisible()), 'the new project is listed; the warning stays until dismissed')
    await context.close()
  }

  // 4. Reload with an open project: Save still updates it (no second card).
  {
    const { context, page } = await openApp(browser, base)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByTestId('save-name').fill('Garcia')
    await page.getByTestId('save-confirm').click()
    await page.locator('#m-W').fill('200')
    await page.locator('#m-W').press('Enter')
    await page.waitForTimeout(500) // URL sync (300 ms)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    const name = await page.textContent('[data-testid=project-name]').catch(() => '')
    check(/Garcia/.test(name) && /edited/.test(name), `after a reload the project is still open and marked edited ("${name?.trim()}")`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByTestId('save-project').click()
    await page.getByTestId('projects').click()
    await page.waitForSelector('[data-testid=projects-home]')
    check((await page.locator('[data-saved]').count()) === 1, 'Save after the reload updates the project (still one card)')
    await page.locator('[data-saved="Garcia"]').getByRole('button', { name: 'Open', exact: true }).click()
    await page.waitForSelector('[data-plan-svg]')
    check((await config(page)).W === 200, '…with the edit (W 200)')
    // A different link in another tab never attaches to the project, and doesn't make this tab forget it.
    await page.waitForTimeout(500)
    const other = await context.newPage()
    await other.goto(`${base}#c=1UW300L132R132D44_bt32s74~s74_la72_ra72.fh`, { waitUntil: 'networkidle' })
    await other.waitForSelector('[data-plan-svg]')
    check((await other.locator('[data-testid=project-name]').count()) === 0, 'another link (new tab) opens without the project')
    await other.reload({ waitUntil: 'networkidle' })
    await other.waitForSelector('[data-plan-svg]')
    check((await other.locator('[data-testid=project-name]').count()) === 0, '…also after its reload')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    check(/Garcia/.test((await page.textContent('[data-testid=project-name]').catch(() => '')) ?? ''), 'and the first tab still has its project after a reload')
    await context.close()
  }

  // 5. Screenshots: editor and home, iPad landscape/portrait, laptop, phone, light and dark.
  for (const scheme of ['light', 'dark']) {
    for (const [vName, vp] of Object.entries({ ...VIEWPORTS, laptop: LAPTOP })) {
      const context = await browser.newContext({ viewport: vp, hasTouch: true, colorScheme: scheme })
      const page = await context.newPage()
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-testid=projects-home]')
      await page.screenshot({ path: `${SHOTS}/p1-${scheme}-${vName}-home.png` })
      await page.getByTestId('new-standardU').click()
      await page.waitForSelector('[data-plan-svg]')
      await page.waitForTimeout(150)
      const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      check(!over, `${scheme} ${vName}: no horizontal overflow`)
      await page.screenshot({ path: `${SHOTS}/p1-${scheme}-${vName}-editor.png` })
      await context.close()
    }
  }
}
