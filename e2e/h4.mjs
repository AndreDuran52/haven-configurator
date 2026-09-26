// H4 done-when checks (plan §10 H4, V5), driven by CDP touch at iPad size,
// DPR 2, and judged by outcome: the committed config (as its share code), the
// undo stack, the DOM.
import { VIEWPORTS } from './browser.mjs'
import { config, warnings } from './lib.mjs'
import { planShapes, topParityIoU } from './parity.mjs'

const SHOTS = 'test-results'
const T1 = '1UW188L132R132D44_bt32s36_la72_ra72.wh'
const T3A = '1UW188L132R132D44_bs68_ls40t32_ra72.j9'
const T3B = '1UW188L132R132D44_bs68_ls13jt32a27j_ra72.wr'

async function open(browser, base, path = '', viewport = VIEWPORTS.ipadLandscape) {
  const context = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-plan-svg]')
  const cdp = await context.newCDPSession(page)
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
  /** A one-finger drag through `path` (client px), a frame per step. */
  const drag = async (path, { hold = 0, cancel = false, during } = {}) => {
    const [x0, y0] = path[0]
    await touch('touchStart', [{ x: x0, y: y0, id: 1 }])
    if (hold) await page.waitForTimeout(hold)
    for (const [x, y] of path.slice(1)) {
      await touch('touchMove', [{ x, y, id: 1 }])
      await page.waitForTimeout(20)
    }
    await page.waitForTimeout(40)
    if (during) await during()
    await touch(cancel ? 'touchCancel' : 'touchEnd', [])
    await page.waitForTimeout(60)
  }
  const tap = async (x, y) => {
    await touch('touchStart', [{ x, y, id: 1 }])
    await page.waitForTimeout(40)
    await touch('touchEnd', [])
    await page.waitForTimeout(120)
  }
  return { context, page, errors, drag, tap }
}

const code = (page) => page.evaluate(() => window.__plan.encode())
const undoDepth = (page) => page.evaluate(() => window.__haven.getState().past.length)
const hasDraft = (page) => page.evaluate(() => window.__haven.getState().draft !== null)
const centreOf = (page, sel) =>
  page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  })
/** Steps from a to b. */
const line = (a, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])
const tableId = async (page) => (await config(page)).runs.back.find((p) => p.kind === 'table')?.id ?? (await config(page)).runs.left.find((p) => p.kind === 'table').id
async function anchor(page, id, match) {
  const all = await page.evaluate((id) => window.__plan.anchors(id), id)
  return all.find((a) => Object.entries(match).every(([k, v]) => a.placement[k] === v)).client
}

export async function h4(browser, base, check) {
  // 1. Seam drag by touch: one undo step, live readout 40" | 28"; touchCancel leaves no trace.
  {
    const { context, page, errors, drag } = await open(browser, base)
    const g = await centreOf(page, '[data-grip="back:1"] circle:nth-of-type(2)')
    const k = await page.evaluate(() => window.__plan.k())
    const d0 = await undoDepth(page)
    let pill = ''
    await drag(line(g, [g[0] + 8 / k, g[1]]), { during: async () => (pill = (await page.textContent('[data-readout]')) ?? '') })
    const c = await config(page)
    check(c.runs.back.map((p) => p.length).join('/') === '40/28', `seam drag by touch: back [${c.runs.back.map((p) => p.length).join(', ')}]`)
    check(pill === '40" | 28"', `seam readout during the drag: "${pill}"`)
    check((await undoDepth(page)) === d0 + 1, 'seam drag = exactly one undo step')
    const before = await code(page)
    await drag(line(g, [g[0] - 6 / k, g[1]]), { cancel: true })
    check((await code(page)) === before && !(await hasDraft(page)) && (await undoDepth(page)) === d0 + 1, 'touchCancel mid-drag leaves no trace (config, draft, history)')
    await page.getByRole('button', { name: 'Undo' }).click()
    check((await code(page)) === T1, 'Undo restores the Standard U')
    // Keyboard: arrows on a grip, coalesced into one step.
    await page.focus('[data-grip="back:1"]')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    const kc = await config(page)
    check(kc.runs.back[0].length === 33.5 && (await undoDepth(page)) === d0 + 1, `grip keys: 3 × → = +1.5″ in one undo step (table ${kc.runs.back[0].length})`)
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 2. Tests 3a and 3b by touch; G1: dragging the 3b table back restores the Standard U, also after a reload.
  {
    const { context, page, errors, drag } = await open(browser, base)
    const id = await tableId(page)
    const t = await centreOf(page, `[data-piece="${id}"]`)
    const d0 = await undoDepth(page)
    const to3b = await anchor(page, id, { run: 'left', at: 'split' })
    let during = []
    await drag(line(t, to3b, 16), { during: async () => (during = await warnings(page)) })
    check((await code(page)) === T3B, `table drag by touch gives 3b (${await code(page)})`)
    check(during.some((w) => /Seat .*under 20|20/.test(w)), `the 3b warning shows during the drag (${during.join('; ')})`)
    check((await undoDepth(page)) === d0 + 1 && (await page.textContent('[data-testid=seats]')).includes('6'), 'one undo step; Seats 6')
    await page.waitForTimeout(400) // URL sync (300 ms)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    check((await code(page)) === T3B, '3b survives a reload (j marker in the link)')
    const id2 = await tableId(page)
    const t2 = await centreOf(page, `[data-piece="${id2}"]`)
    const back = await anchor(page, id2, { run: 'back', at: 'seam', seam: 0 })
    await drag(line(t2, back, 16))
    check((await code(page)) === T1, `dragging it back to the back run restores the Standard U after the reload (G1) (${await code(page)})`)
    // 3a: in place of the left arm.
    const id3 = await tableId(page)
    const t3 = await centreOf(page, `[data-piece="${id3}"]`)
    await drag(line(t3, await anchor(page, id3, { run: 'left', at: 'replaceArm' }), 16))
    check((await code(page)) === T3A, `table drag by touch gives 3a (${await code(page)})`)
    // Dropped on nothing: snaps back.
    const id4 = await tableId(page)
    const t4 = await centreOf(page, `[data-piece="${id4}"]`)
    const box = await page.$eval('[data-plan-svg]', (e) => e.getBoundingClientRect().toJSON())
    const svgOut = [box.right + 40, box.top + box.height / 2]
    await drag(line(t4, svgOut, 10))
    check((await code(page)) === T3A, 'a table dropped outside the plan snaps back')
    await page.screenshot({ path: `${SHOTS}/h4-3a.png` })
    // Trash: drag the table onto the tray.
    const d1 = await undoDepth(page)
    const trashAt = await page.$eval('[data-tray]', (e) => {
      const r = e.getBoundingClientRect()
      return [r.left + r.width / 2, r.top + r.height / 2]
    })
    await drag(line(t4, trashAt, 16))
    const ct = await config(page)
    check(!Object.values(ct.runs).some((ps) => ps.some((p) => p.kind === 'table')) && (await undoDepth(page)) === d1 + 1, 'dropping a table on the tray (trash) removes it in one step')
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 3. Tap selects and opens the tap menu; its actions are single undo steps; Delete key; Escape.
  {
    const { context, page, errors, tap } = await open(browser, base)
    const c = await config(page)
    const seat = c.runs.back.find((p) => p.kind === 'armless').id
    await tap(...(await centreOf(page, `[data-piece="${seat}"]`)))
    const sel = await page.evaluate(() => window.__haven.getState().ui.selectedId)
    await page.waitForSelector('[data-tap-menu]')
    const title = await page.textContent('[data-tap-menu] h2')
    check(sel === seat && /Armless seat · 36"/.test(title), `tap selects and opens the menu ("${title}")`)
    await page.screenshot({ path: `${SHOTS}/h4-tapmenu-ipadLandscape.png` })
    const d0 = await undoDepth(page)
    await page.locator('[data-tap-menu]').getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(80)
    const after = await config(page)
    check(!after.runs.back.some((p) => p.id === seat) && (await undoDepth(page)) === d0 + 1, 'menu Delete: piece gone, one undo step')
    await page.getByRole('button', { name: 'Undo' }).click()
    // Table: width chips and the style.
    const tid = await tableId(page)
    await tap(...(await centreOf(page, `[data-piece="${tid}"]`)))
    await page.waitForSelector('[data-tap-menu]')
    await page.locator('[data-tap-menu]').getByRole('button', { name: '28″' }).click()
    await page.locator('[data-tap-menu]').getByRole('radio', { name: 'All wood' }).click()
    await page.waitForTimeout(400)
    const tc = await config(page)
    check(tc.runs.back[0].length === 28 && tc.tableStyle === 'allWood', `table menu: width 28 and style All wood (${tc.runs.back[0].length}, ${tc.tableStyle})`)
    check((await page.evaluate(() => location.hash)).startsWith('#c=2'), 'a non-standard table style shares as a v2 link')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
    check(!(await page.$('[data-tap-menu]')), 'Escape closes the menu')
    // Delete key on a selection.
    await tap(...(await centreOf(page, `[data-piece="${tid}"]`)))
    await page.keyboard.press('Delete')
    await page.waitForTimeout(80)
    check(!(await config(page)).runs.back.some((p) => p.kind === 'table'), 'Delete key removes the selected piece')
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(80)
    check((await config(page)).runs.back.some((p) => p.kind === 'table'), 'Ctrl+Z undoes it')
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 4. Tray: tap-to-place pins; drag from the tray; long-press reorder.
  {
    const { context, page, errors, drag, tap } = await open(browser, base)
    const d0 = await undoDepth(page)
    await tap(...(await centreOf(page, '[data-tray-item=armless]')))
    const pins = Number(await page.getAttribute('[data-pins]', 'data-count'))
    check(pins > 0, `tap-to-place shows + pins (${pins})`)
    await page.screenshot({ path: `${SHOTS}/h4-pins.png` })
    await tap(...(await centreOf(page, '[data-pin="0"] circle:nth-of-type(2)')))
    const n = (c) => Object.values(c.runs).flat().filter((p) => p.kind === 'armless').length
    check(n(await config(page)) === 2 && (await undoDepth(page)) === d0 + 1 && !(await page.$('[data-pins]')), 'tapping a pin adds an armless seat in one step')
    await page.getByRole('button', { name: 'Undo' }).click()
    // Drag a table chip into the right leg.
    const chip = await centreOf(page, '[data-tray-item=table]')
    const r = (await config(page)).runs.right[0]
    const rp = await centreOf(page, `[data-piece="${r.id}"]`)
    await drag(line(chip, rp, 16))
    const rc = await config(page)
    check(rc.runs.right.some((p) => p.kind === 'table') && (await undoDepth(page)) === d0 + 1, `dragging "Table 32″" from the tray places it in the right leg (${rc.runs.right.map((p) => p.kind + p.length).join(' ')})`)
    await page.getByRole('button', { name: 'Undo' }).click()
    // Long-press reorder: the back seat moves before the table.
    const back = (await config(page)).runs.back
    const s = await centreOf(page, `[data-piece="${back[1].id}"]`)
    const t = await centreOf(page, `[data-piece="${back[0].id}"]`)
    await drag(line(s, [t[0] - 30, s[1]], 10), { hold: 420 })
    const rb = (await config(page)).runs.back
    check(rb.map((p) => p.kind).join(',') === 'armless,table' && (await undoDepth(page)) === d0 + 1, `long-press reorder: back [${rb.map((p) => p.kind + p.length).join(', ')}] in one step`)
    // A quick touch move (no long-press) doesn't reorder.
    const s2 = await centreOf(page, `[data-piece="${rb[0].id}"]`)
    await drag(line(s2, [s2[0] + 80, s2[1]], 6))
    check((await config(page)).runs.back[0].kind === 'armless', 'a quick touch swipe on a seat does not reorder')
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 5. Loose pieces: coffee table from the tray, drag with live clearances; 3D Top parity and framing.
  {
    const { context, page, errors, drag, tap } = await open(browser, base)
    await tap(...(await centreOf(page, '[data-tray-item=coffeeTable]')))
    const c = await config(page)
    const ct = c.loose[0]
    check(ct?.kind === 'coffeeTable', 'tapping "Coffee table" adds one (selected, menu open)')
    const lines = await page.$$eval('[data-clearance] [data-region]', (els) => els.map((e) => [e.dataset.region, e.dataset.dist]))
    check(lines.length >= 3, `clearance dimensions shown (${lines.map((l) => l.join(' ')).join(', ')})`)
    await page.keyboard.press('Escape')
    const k = await page.evaluate(() => window.__plan.k())
    const at = await centreOf(page, `[data-piece="${ct.id}"]`)
    let amber = 0
    await drag(line(at, [at[0], at[1] - 10 / k], 10), { during: async () => (amber = (await page.$$('[data-clearance] [data-short]')).length) })
    const moved = (await config(page)).loose[0]
    check(Math.abs(moved.y - (ct.y - 10)) <= 0.5 && moved.x === ct.x, `coffee table dragged 10″ toward the back (y ${ct.y} → ${moved.y})`)
    check(amber > 0, `clearances under 14″ turn amber during the drag (${amber})`)
    await page.screenshot({ path: `${SHOTS}/h4-coffee.png` })
    await page.mouse.click(5, 5) // clear the selection (no selection outline in the silhouette)
    const shapes = await planShapes(page)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.waitForTimeout(900)
    const iou = await topParityIoU(page, shapes)
    check(iou >= 0.999, `coffee table in 3D Top at parity (IoU ${iou.toFixed(5)})`)
    for (const name of ['top', 'threeQuarter', 'iso', 'front', 'side']) {
      await page.locator(`[data-preset=${name}]`).click()
      await page.waitForTimeout(200)
      await page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 20000, polling: 100 })
      const out = await page.evaluate(() => {
        const api = window.__haven3d
        const [w, h] = api.state().size
        const pad = Math.round(Math.min(64, Math.max(20, 0.06 * Math.min(w, h))))
        return api.project(api.points()).filter(([x, y]) => x < pad - 0.5 || x > w - pad + 0.5 || y < pad - 0.5 || y > h - pad + 0.5).length
      })
      check(out === 0, `${name}: framed with the coffee table (${out} points outside)`)
    }
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 6. Blank U filled piece by piece until export unblocks.
  {
    const { context, page, errors, tap } = await open(browser, base)
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.getByRole('button', { name: 'Start blank' }).click()
    await page.waitForSelector('[data-gap]')
    check(await page.evaluate(() => window.__plan.exportBlocked()), 'Blank U: export blocked')
    for (let i = 0; i < 3; i++) {
      const g = await centreOf(page, '[data-gap] rect')
      await tap(...g)
      await page.waitForSelector('[data-tap-menu]')
      await page.locator('[data-tap-menu]').getByRole('button', { name: 'Armless seat' }).click()
      await page.waitForTimeout(80)
    }
    const gaps = await page.$$('[data-gap]')
    check(gaps.length === 0 && !(await page.evaluate(() => window.__plan.exportBlocked())), `filled piece by piece: no gaps, export unblocked (${gaps.length} gaps left)`)
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 7. Mouse: seam line (±7 px) and a drag-to-reorder; screenshots at 3 viewports with the menu open.
  {
    const { context, page } = await open(browser, base)
    const g = await page.$eval('[data-grip="back:1"] line', (e) => {
      const r = e.getBoundingClientRect()
      return [r.left + r.width / 2, r.top + 4]
    })
    const k = await page.evaluate(() => window.__plan.k())
    await page.mouse.move(g[0] + 3, g[1] - 20)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(g[0] + 3 - (i * 4) / k / 8, g[1] - 20, { steps: 1 })
    await page.mouse.up()
    await page.waitForTimeout(80)
    const c = await config(page)
    check(c.runs.back[0].length === 28, `mouse drag on the seam line itself: table ${c.runs.back[0].length}″`)
    await context.close()
  }
  for (const [vName, vp] of Object.entries(VIEWPORTS)) {
    const { context, page, tap } = await open(browser, base, '', vp)
    const seat = (await config(page)).runs.left[0].id
    await tap(...(await centreOf(page, `[data-piece="${seat}"]`)))
    await page.waitForSelector('[data-tap-menu]')
    const inView = await page.$eval('[data-tap-menu]', (e) => {
      const r = e.getBoundingClientRect()
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5
    })
    // body overflow is hidden, so also measure the plan itself (a wide tray once stretched it off-screen)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector('[data-plan-svg]').getBoundingClientRect().right > innerWidth + 0.5)
    check(inView && !overflow, `${vName}: tap menu fully on screen, no horizontal scroll`)
    await page.screenshot({ path: `${SHOTS}/h4-${vName}-menu.png` })
    await context.close()
  }
}
