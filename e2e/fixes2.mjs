// Fixes before the seat markers (Andre, 2026-11-09): the View menu shows only
// what works in the current view; plan pillows match the 3D Top (same
// position, angle and size, pillow by pillow); the Room tab's two rows (arrows
// and typed gaps, one Undo per hold); the tray's Table tapped goes to the
// middle (straight 120″ with 10″ arms: 10 | 34 | 32 | 34 | 10) and a sofa with
// no room for one refuses cleanly. Judged by outcome: the DOM, the store, the
// 3D meshes' own bounds.
import { config, panel, setField, viewMenu } from './lib.mjs'
import { shot } from './phase3.mjs'

const LAPTOP = { width: 1440, height: 900 }
const U = '1UW188L132R132D44_bt32s36_la72_ra72.wh'

async function fresh(browser, base, path = '') {
  const context = await browser.newContext({ viewport: LAPTOP })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForSelector(path ? '[data-plan-svg]' : '[data-testid=projects-home]')
  return { context, page, errors }
}
const code = (page) => page.evaluate(() => window.__plan.encode())
const undoDepth = (page) => page.evaluate(() => window.__haven.getState().past.length)
const gaps = (page) => page.$$eval('[data-room-gap]', (els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-room-gap'), Number(e.getAttribute('data-gap'))])))
const back = (c) => c.runs.back.map((p) => p.kind + p.length).join(' ')

/** Each plan pillow's bounding box in plan inches, by key. */
const planPillowBoxes = (page) =>
  page.$$eval('[data-plan-svg] [data-pillow]', (els) =>
    Object.fromEntries(
      els.map((e) => {
        const key = e.getAttribute('data-pillow-key')
        if (e.tagName === 'circle') {
          const [cx, cy, r] = ['cx', 'cy', 'r'].map((a) => Number(e.getAttribute(a)))
          return [key, [cx - r, cy - r, cx + r, cy + r]]
        }
        const p = e.getAttribute('points').trim().split(/\s+/).map((q) => q.split(',').map(Number))
        return [key, [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))]]
      }),
    ),
  )

export async function fixes2(browser, base, check) {
  // 1. The View menu: Plan style only in the plan; pillows match the 3D Top.
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    await page.waitForSelector('[data-plan-svg] [data-pillow]')
    await viewMenu(page)
    check((await page.getByTestId('pillows').count()) === 1 && (await page.getByTestId('plan-style').count()) === 1, 'Plan: the View menu has Pillows and Plan style')
    await page.keyboard.press('Escape')
    await page.mouse.click(5, 300)
    const plan = await planPillowBoxes(page)
    const areas = await page.$$eval('[data-pillow=square]', (els) => els.map((e) => {
      const p = e.getAttribute('points').trim().split(/\s+/).map((q) => q.split(',').map(Number))
      return Math.abs(p.reduce((s, [x, y], i) => s + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0)) / 2
    }))
    const box = await page.locator('[data-testid=plan-view]').boundingBox()
    await page.screenshot({ path: 'test-results/fixes2-pillows-plan.png', clip: box })
    const fit = await page.evaluate(() => window.__haven.getState().ui.planFit)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.waitForFunction(() => window.__haven3d.models().square, null, { timeout: 30000 })
    await viewMenu(page)
    check((await page.getByTestId('pillows').count()) === 1 && (await page.getByTestId('plan-style').count()) === 0, '3D: the View menu has Pillows only (Plan style does nothing there)')
    await page.keyboard.press('Escape')
    const three = await page.evaluate(({ fit }) => {
      const api = window.__haven3d
      api.setTopAt(fit.S, fit.cx, fit.cy)
      const [ox, oz] = api.offset
      return Object.fromEntries(api.bounds('pillow:').map((b) => [b.name.slice('pillow:'.length), [b.min[0] - ox, b.min[2] - oz, b.max[0] - ox, b.max[2] - oz]]))
    }, { fit })
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/fixes2-pillows-3d-top.png', clip: box })
    const keys = Object.keys(plan)
    const off = keys.map((k) => (three[k] ? Math.max(...plan[k].map((v, i) => Math.abs(v - three[k][i]))) : Infinity))
    check(keys.length === 10 && Object.keys(three).length === 10, `10 pillows in the plan and in 3D (${keys.length}, ${Object.keys(three).length})`)
    check(Math.max(...off) <= 0.5, `each plan pillow covers the same ground as its 3D pillow from above (worst ${Math.max(...off).toFixed(2)}″)`)
    // From above a square pillow is about 20 × 13″ (leaning on the back cushion), not a 20″ square (400 sq in).
    check(areas.length === 8 && areas.every((a) => a < 300), `square pillows read narrow from above (${areas.map((a) => a.toFixed(0)).join(', ')} sq in, not 400)`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. The Room tab: Sofa position, two rows, arrows and typed gaps, one Undo per hold.
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    await panel(page, 'Room')
    await setField(page, 'roomW', 240)
    await page.waitForSelector('[data-room]')
    check((await page.getByRole('radiogroup', { name: 'Sofa position' }).count()) === 1, '"Sofa position: Center | Back wall | Custom"')
    const text = await page.textContent('#panel-room')
    check(text.includes('Side to side') && text.includes('Front to back') && !text.includes('a tap'), 'two rows, Side to side and Front to back; no helper text')
    const g0 = await gaps(page)
    await page.getByTestId('nudge-right').click()
    const g1 = await gaps(page)
    check(g1.left === g0.left + 1 && g1.right === g0.right - 1, `→ moves the sofa 1″ right; both numbers change (${g0.left} | ${g0.right} → ${g1.left} | ${g1.right})`)
    check((await page.inputValue('#m-gap-left')) === String(g1.left) && (await page.inputValue('#m-gap-right')) === String(g1.right), 'the row shows both new numbers')
    check((await page.getByRole('radio', { name: 'Custom' }).getAttribute('aria-checked')) === 'true', 'an arrow makes the position Custom')
    await setField(page, 'gap-right', 20)
    check((await gaps(page)).left === 240 - 188 - 20 && (await page.inputValue('#m-gap-left')) === '32', 'typing Right 20: Left follows to 32')
    await page.waitForTimeout(1000)
    const d = await undoDepth(page)
    const up = await page.getByTestId('nudge-back').boundingBox()
    await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(1000)
    await page.mouse.up()
    const g2 = await gaps(page)
    check(g2.back < g1.back - 3 && (await undoDepth(page)) === d + 1, `holding ↑ keeps going, one undo step (back ${g1.back} → ${g2.back})`)
    await page.getByRole('radio', { name: 'Center' }).click()
    const g3 = await gaps(page)
    check(g3.left === g3.right && g3.back === g3.front, `Center snaps it back (${JSON.stringify(g3)})`)
    await shot(browser, page, 'fixes2-room-1440')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 3. The tray's Table tapped: the most central seam, both seats shrink equally; Undo restores.
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByTestId('new-straight').click()
    await page.waitForSelector('[data-plan-svg]')
    await setField(page, 'A', 10)
    check(back(await config(page)) === 'oneArm60 oneArm60' && (await config(page)).dims.A === 10, "Andre's straight: 120″ with 10″ arms (10 | 50 | 50 | 10)")
    const before = await code(page)
    const d = await undoDepth(page)
    await panel(page, 'Pieces')
    await page.locator('[data-tray-item=table]').click()
    const c = await config(page)
    check(back(c) === 'oneArm44 table32 oneArm44' && c.W === 120, `Table tapped: 10 | 34 | 32 | 34 | 10 (${back(c)})`)
    check((await undoDepth(page)) === d + 1 && (await page.$('[data-pins]')) === null, 'one undo step; no pins to pick')
    const line = await page.textContent('[data-testid=result-text]')
    check(line.includes('Added table 32″') && line.includes('Seats 50″ | 50″ → 34″ | 34″'), `the result line: "${line}"`)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check((await code(page)) === before, 'Undo restores the sofa before the table')
    // No room for a table anywhere: refused in plain words, nothing changes.
    await panel(page, 'Size')
    await setField(page, 'W', 72)
    const tight = await code(page)
    const d2 = await undoDepth(page)
    await panel(page, 'Pieces')
    await page.locator('[data-tray-item=table]').click()
    await page.waitForSelector('[data-testid=toast]')
    const toast = await page.textContent('[data-testid=toast]')
    check(toast.includes('Not enough seat for a table here.') && (await code(page)) === tight && (await undoDepth(page)) === d2, `refused cleanly: "${toast.trim()}", layout and Undo unchanged`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }
}
