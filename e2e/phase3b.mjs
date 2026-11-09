// UX Phase 3b checks (Andre's notes, 2026-11-08; shared over Zoom from a
// laptop): no dark mode, Look → Design, the Size tab's depth chips (36 · 40 ·
// 44 · Other) with the seat depth (sofa depth − 18), hold ± to repeat (one undo
// step), "When pieces change: Other seats adjust | Sofa size changes" on the
// Pieces tab (arm width on Size and Tables on Design since 2026-11-09), one
// Pillows switch for the plan, the 3D cameras
// Overview | Top | Front | Side, no 3D snap-back (a double-click returns to the
// preset), no scale bar, no interface text under 14 px on any tab, and the
// top bar's menus opening on top of the page (a Phase 3 regression: the bar
// clipped them).
// Room tab checks are in room.mjs. Judged by outcome: the DOM and the store.
import { VIEWPORTS } from './browser.mjs'
import { config, panel, setField, viewMenu } from './lib.mjs'
import { shot, smallText } from './phase3.mjs'

const LAPTOP = { width: 1440, height: 900 }
const LAPTOP_SMALL = { width: 1280, height: 800 }

async function fresh(browser, base, opts = {}) {
  const context = await browser.newContext({ viewport: LAPTOP, ...opts })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByTestId('new-standardU').click()
  await page.waitForSelector('[data-plan-svg]')
  await page.waitForTimeout(150)
  return { context, page, errors }
}
const undoDepth = (page) => page.evaluate(() => window.__haven.getState().past.length)
const seatDepth = (page) => page.$eval('[data-testid=seat-depth] span', (e) => e.textContent)
const pressed = (page) => page.$$eval('[aria-label="Depth presets"] button', (els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.textContent))
const state3d = (page) => page.evaluate(() => window.__haven3d.state())
const settle = (page) => page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 30000, polling: 100 })

/** Is the element's centre really on top (what a click there would hit)? */
const onTop = (page, sel) =>
  page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect()
    return e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
  })

export async function phase3b(browser, base, check) {
  // 0. The top bar's menus open over the page at laptop and phone sizes; the phone never scrolls sideways.
  for (const vp of [LAPTOP, VIEWPORTS.phone]) {
    const { context, page, errors } = await fresh(browser, base, { viewport: vp })
    await page.getByTestId('project-name').click()
    check((await onTop(page, '[data-testid=menu-start]')) && (await onTop(page, '[data-testid=menu-reset]')), `${vp.width}: the project menu's items are on top (clickable)`)
    await page.keyboard.press('Escape')
    if (vp === LAPTOP) {
      await page.getByTestId('settings').click()
      check(await onTop(page, '[aria-label="Seat width minus 1"]'), `${vp.width}: the Settings menu is on top (clickable)`)
      await page.keyboard.press('Escape')
    }
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${vp.width}: no sideways scroll`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 1. One light look (even when the computer is in dark mode), the tabs, the Size tab.
  {
    const { context, page, errors } = await fresh(browser, base, { colorScheme: 'dark' })
    const bg = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).colorScheme])
    check(bg[0] === 'rgb(246, 243, 238)' && bg[1] === 'light', `no dark mode: a dark-mode computer still gets the light look (${bg.join(', ')})`)
    const tabs = await page.$$eval('[role=tab]', (els) => els.map((e) => e.textContent.replace(/\d+$/, '')))
    check(tabs.join(' | ') === 'Size | Room | Pieces | Design', `tabs: ${tabs.join(' | ')}`)
    const chips = await page.$$eval('[aria-label="Depth presets"] button', (els) => els.map((e) => e.textContent))
    check(chips.join(' | ') === '36″ | 40″ | 44″ | Other', `depth chips: ${chips.join(' | ')}`)
    check((await seatDepth(page)) === '26″' && (await pressed(page)).join() === '44″', `44″ deep: seat depth 26″, 44″ chosen (${await seatDepth(page)})`)
    await page.getByRole('button', { name: '36″', exact: true }).click()
    check((await seatDepth(page)) === '18″' && (await config(page)).D === 36, `36″ deep: seat depth 18″ (${await seatDepth(page)})`)
    await setField(page, 'D', 42)
    check((await seatDepth(page)) === '24″' && (await pressed(page)).join() === 'Other', `a typed 42″: seat depth 24″, "Other" chosen (${(await pressed(page)).join()})`)
    await page.getByTestId('depth-other').click()
    check((await page.evaluate(() => document.activeElement?.id)) === 'm-D', '"Other" puts the cursor in the Depth field')
    await page.keyboard.press('Escape')
    const sizeText = await page.textContent('#panel-size')
    check(!/When pieces change/.test(sizeText) && /Arm width/.test(sizeText), 'the Size tab: arm width with the measurements (2026-11-09), no "When pieces change"')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. Hold ± to keep going: one undo step for the whole hold; the result line says it all.
  {
    const { context, page, errors } = await fresh(browser, base)
    const d0 = await undoDepth(page)
    const plus = await page.getByRole('button', { name: 'Width plus 1' }).boundingBox()
    await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(1200)
    await page.mouse.up()
    const W = (await config(page)).W
    check(W >= 188 + 5, `holding Width + for 1.2 s keeps going: 188 → ${W}`)
    await page.waitForTimeout(500)
    check((await config(page)).W === W, 'letting go stops it')
    check((await undoDepth(page)) === d0 + 1, `the hold is one undo step (${(await undoDepth(page)) - d0})`)
    await page.waitForSelector('[data-testid=result-text]')
    const line = await page.textContent('[data-testid=result-text]')
    check(line.startsWith(`Width 188″ → ${W}″`), `the result line covers the whole hold: "${line}"`)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check((await config(page)).W === 188, 'one Undo: back to 188')
    // The seat width in Settings repeats too.
    await page.getByTestId('settings').click()
    const minus = await page.getByRole('button', { name: 'Seat width minus 1' }).boundingBox()
    await page.mouse.move(minus.x + minus.width / 2, minus.y + minus.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(800)
    await page.mouse.up()
    check((await config(page)).seatWidth <= 28 - 3, `holding Seat width − repeats (28 → ${(await config(page)).seatWidth})`)
    await page.keyboard.press('Escape')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 3. Pieces: Add a piece and the lock wording only; arm width in Size; Design: Fabric, Tables, Wood (2026-11-09).
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByRole('button', { name: 'Arm width minus 0.5' }).click()
    check((await config(page)).dims.A === 13.5, 'arm width − on the Size tab: 13½″')
    await panel(page, 'Pieces')
    const heads = await page.$$eval('#panel-pieces h2', (els) => els.map((e) => e.textContent))
    check(heads.join(' | ') === 'Add a piece | When pieces change', `Pieces: ${heads.join(' | ')}`)
    const lock = await page.$$eval('[aria-label="When pieces change"] [role=radio]', (els) => els.map((e) => `${e.textContent}${e.getAttribute('aria-checked') === 'true' ? '*' : ''}`))
    check(lock.join(' | ') === 'Other seats adjust* | Sofa size changes', `"When pieces change": ${lock.join(' | ')}`)
    await page.getByRole('radio', { name: 'Sofa size changes' }).click()
    check((await config(page)).lockOutside === false, '"Sofa size changes" turns the lock off')
    await shot(browser, page, 'phase3b-pieces-1440')
    await panel(page, 'Design')
    const look = await page.$$eval('#panel-look h2', (els) => els.map((e) => e.textContent))
    check(look.join(' | ') === 'Fabric | Tables | Wood', `Design: ${look.join(' | ')}`)
    const styles = await page.$$eval('[aria-label="Table style"] [role=radio]', (els) => els.map((e) => e.textContent))
    check(styles.join(' | ') === 'Wood top on fabric base | All wood' && !(await page.textContent('#panel-look')).includes('Solid wood'), `Tables: ${styles.join(' | ')}, no line underneath`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 4. Pillows in the plan: on by default, one per 3D pillow; the switch hides them.
  {
    const { context, page, errors } = await fresh(browser, base)
    const count = () => page.$$eval('[data-plan-svg] [data-pillow]', (els) => els.map((e) => e.getAttribute('data-pillow')))
    await page.waitForSelector('[data-plan-svg] [data-pillow]')
    const on = await count()
    check(on.filter((k) => k === 'square').length === 8 && on.filter((k) => k === 'ball').length === 2, `the Standard U plan shows 8 square pillows and 2 balls (${on.length})`)
    await shot(browser, page, 'phase3b-plan-pillows-1440')
    await viewMenu(page)
    await page.getByRole('menuitemcheckbox', { name: 'Pillows' }).click()
    await page.keyboard.press('Escape')
    check((await count()).length === 0 && (await page.evaluate(() => window.__haven.getState().ui.pillows)) === false, 'Pillows off: none in the plan (and none in 3D)')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 5. 3D: Overview | Top | Front | Side; the camera stays where the mouse leaves it; a double-click returns.
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await settle(page)
    const cams = await page.$$eval('[data-testid=presets] [role=radio]', (els) => els.map((e) => e.textContent))
    check(cams.join(' | ') === 'Overview | Top | Front | Side', `cameras: ${cams.join(' | ')}`)
    await page.locator('[data-preset=top]').click()
    await settle(page)
    const top = await state3d(page)
    check(top.preset === 'top' && Math.abs(top.polarDeg) < 1e-3, `Top looks straight down (polar ${top.polarDeg.toFixed(3)}°)`)
    check((await page.locator('[data-testid=scale-bar]').count()) === 0, 'no scale bar in Top')
    await page.locator('[data-preset=threeQuarter]').click()
    await settle(page)
    const s0 = await state3d(page)
    const box = await page.locator('[data-testid=three-view] canvas').boundingBox()
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let i = 1; i <= 15; i++) {
      await page.mouse.move(cx + i * 14, cy - i * 4)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()
    await page.waitForTimeout(1200)
    await settle(page)
    const left = await state3d(page)
    check(Math.abs(left.azimuthDeg - s0.azimuthDeg) > 10, `no snap-back: the camera stays where it was let go (${s0.azimuthDeg.toFixed(1)}° → ${left.azimuthDeg.toFixed(1)}°)`)
    await page.mouse.dblclick(cx, cy)
    await settle(page)
    const back = await state3d(page)
    check(Math.abs(back.azimuthDeg - s0.azimuthDeg) < 1e-3 && Math.abs(back.polarDeg - s0.polarDeg) < 1e-3 && Math.abs(back.zoom - s0.zoom) < 1e-3, `a double-click returns to Overview (${back.azimuthDeg.toFixed(3)}°)`)
    await shot(browser, page, 'phase3b-3d-1440')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 6. No text under 14 px on any tab, at both laptop sizes; screenshots (also at half scale).
  {
    const { context, page, errors } = await fresh(browser, base)
    for (const vp of [LAPTOP, LAPTOP_SMALL]) {
      await page.setViewportSize(vp)
      for (const tab of ['Size', 'Room', 'Pieces', 'Design']) {
        await panel(page, tab)
        if (tab === 'Room' && !(await page.$('[data-room]'))) await setField(page, 'roomW', 264)
        await page.waitForTimeout(150)
        const small = await smallText(page)
        check(small.length === 0, `${vp.width}×${vp.height} ${tab}: no text under 14 px (${small.join('; ')})`)
        if (vp === LAPTOP && tab !== 'Pieces') await shot(browser, page, `phase3b-${tab.toLowerCase()}-1440`)
      }
    }
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }
}
