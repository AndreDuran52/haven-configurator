// H6c room floor checks (Andre, 2026-11-07; the Room tab of Phase 3b): typing
// the room width creates the room (no Add step), its size, Center and Back
// wall, the four typed distances (Custom), the move pad (hold = one undo
// step), Fill the width, the walkway and fit warnings, the v5 link in a fresh
// browser, 3D Top parity with the room floor, the PDF header, and labels at
// three sizes. Judged by outcome: the layout, the link, the DOM, the PDF text.
import { VIEWPORTS } from './browser.mjs'
import { pdfText } from './h6.mjs'
import { labelCheck, panel, setField, warnings } from './lib.mjs'
import { planShapes, topParityIoU } from './parity.mjs'

const SHOTS = 'test-results'
/** Golden v5: the Standard U in a 240 × 200 room, centred. */
const U_ROOM = '5UW188L132R132D44_bt32s36_la72_ra72_Mw240d200.zy'

const layout = (page) => page.evaluate(() => window.__haven.getState().layout)
const code = (page) => page.evaluate(() => window.__plan.encode())
const gaps = (page) => page.$$eval('[data-room-gap]', (els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-room-gap'), Number(e.getAttribute('data-gap'))])))

async function fresh(browser, url, viewport = VIEWPORTS.ipadLandscape, scheme = 'light') {
  const context = await browser.newContext({ viewport, hasTouch: true, colorScheme: scheme })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(url, { waitUntil: 'networkidle' })
  return { context, page, errors }
}

export async function room(browser, base, check) {
  // 1. A straight sofa: type the room, Back wall, typed distances, the move pad, Fill the width.
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByTestId('new-straight').click()
    await page.waitForSelector('[data-plan-svg]')
    await panel(page, 'Room')
    check((await page.getByTestId('add-room').count()) === 0 && (await page.getByTestId('room-hint').count()) === 1 && (await page.inputValue('#m-roomW')) === '', 'no "Add the room" step: blank Room width and length, and a hint')
    await setField(page, 'roomW', '200')
    await page.waitForSelector('[data-room]')
    const l0 = await layout(page)
    check(l0.room?.w === 200 && l0.room?.d === 144 && l0.room.at.mode === 'center', `typing the width creates the room: 200 × 144 (length suggested), centred (${JSON.stringify(l0.room)})`)
    await setField(page, 'roomD', '150')
    check(JSON.stringify(await gaps(page)) === JSON.stringify({ left: 40, right: 40, back: 53, front: 53 }), `typed 200 × 150: gaps ${JSON.stringify(await gaps(page))}`)
    await page.getByRole('radio', { name: 'Back wall' }).click()
    const g1 = await gaps(page)
    check(g1.back === undefined && g1.front === 106 && g1.left === 40, `Back wall: back 0 (not drawn), front 106 (${JSON.stringify(g1)})`)
    await setField(page, 'gap-left', '10')
    const l1 = await layout(page)
    check(l1.room.at.mode === 'free' && (await gaps(page)).left === 10 && (await gaps(page)).right === 70, `a typed left distance of 10: the room stays put (${JSON.stringify(l1.room.at)})`)
    check((await page.getByRole('radio', { name: 'Custom' }).getAttribute('aria-checked')) === 'true', 'the placement reads "Custom"')
    await setField(page, 'gap-right', '20')
    await setField(page, 'gap-front', '30')
    const gr = await gaps(page)
    check(gr.left === 60 && gr.right === 20 && gr.front === 30 && gr.back === 76, `typed right 20 and front 30: left 60, back 76 follow (${JSON.stringify(gr)})`)
    // The move pad: a tap moves 1″; a hold keeps going and is one undo step.
    await page.getByTestId('nudge-left').click()
    check((await gaps(page)).left === 59 && (await gaps(page)).right === 21, `← moves the sofa 1″ left (${JSON.stringify(await gaps(page))})`)
    await page.waitForTimeout(1000)
    const depth = await page.evaluate(() => window.__haven.getState().past.length)
    const pad = await page.getByTestId('nudge-back').boundingBox()
    await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(1100)
    await page.mouse.up()
    const held = await gaps(page)
    check(held.back < 76 - 3 && held.front > 30 + 3, `holding ↑ keeps moving toward the back wall (back ${held.back}, front ${held.front})`)
    check((await page.evaluate(() => window.__haven.getState().past.length)) === depth + 1, 'the whole hold is one undo step')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check((await gaps(page)).back === 76, 'Undo puts it back in one go')
    await setField(page, 'gap-left', '10')
    const past = await page.evaluate(() => window.__haven.getState().past.length)
    await page.getByTestId('fill-width').click()
    const l2 = await layout(page)
    check(l2.sections[0].config.W === 180 && (await gaps(page)).right === 10, `Fill the width: W 180, 10″ from each wall (W ${l2.sections[0].config.W})`)
    check((await page.evaluate(() => window.__haven.getState().past.length)) === past + 1, 'Fill the width is one undo step')
    check((await code(page)).startsWith('5iW180'), `the link is v5 (${(await code(page)).slice(0, 12)}…)`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. The U by its v5 link: walkway warnings, fit warning, 3D Top parity, PDF.
  {
    const { context, page, errors } = await fresh(browser, `${base}#c=${U_ROOM}`)
    await page.waitForSelector('[data-room]')
    check((await code(page)) === U_ROOM, 'the v5 link opens the same layout and re-encodes byte for byte')
    const g = await gaps(page)
    check(JSON.stringify(g) === JSON.stringify({ left: 26, right: 26, back: 34, front: 34 }), `centred: ${JSON.stringify(g)}`)
    check((await page.$$('[data-room-gap][data-short]')).length === 2, 'the two 26″ walkways show amber')
    await panel(page, 'Room')
    const w = await warnings(page)
    check(w.includes('Walkway 26″ between the sofa and the left wall (under 30)') && w.includes('Walkway 26″ between the sofa and the right wall (under 30)'), `walkway warnings listed (${w.join(' | ')})`)
    await setField(page, 'roomW', '180')
    const big = await page.textContent('[data-testid=room-too-big-across]').catch(() => null)
    check(big === 'Sofa is 8″ wider than the room', `a 180″ room: one plain line on the Side to side row ("${big}")`)
    check((await page.$$('[data-testid=room-across] input')).length === 0, 'no side distances or arrows while the sofa is wider than the room')
    check((await page.$$eval('[data-room-gap]', (els) => els.filter((e) => Number(e.getAttribute('data-gap')) < 0).length)) === 0, 'the plan draws no negative gaps')
    check(!(await warnings(page)).some((x) => x.includes('wider')), 'the line is not repeated in the warnings list')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.screenshot({ path: `${SHOTS}/room-u-plan.png` })
    await page.mouse.click(5, 5)
    const shapes = await planShapes(page)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.waitForTimeout(900)
    const iou = await topParityIoU(page, shapes)
    check(iou >= 0.999, `3D Top matches the plan with the room floor (IoU ${iou.toFixed(5)})`)
    await page.getByRole('radio', { name: 'Plan' }).click()
    await page.getByTestId('share').click()
    await page.waitForSelector('[data-testid=sheet-views]')
    await page.getByTestId('make-pdf').click()
    await page.waitForSelector('[data-testid=made]', { timeout: 60000 })
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
    const path = `${SHOTS}/room.pdf`
    await dl.saveAs(path)
    const pdf = await pdfText(path)
    const header = pdf.items.find((i) => i.str.startsWith('U shape'))?.str.replace(/\s+/g, ' ')
    check(header?.endsWith('· Room 240" x 200"'), `PDF header "${header}"`)
    check(pdf.items.some((i) => i.str.startsWith('Room 240"')) && pdf.items.some((i) => i.str.startsWith('Room 200"')), 'the PDF plan shows the room width and depth')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 3. Remove the room: the link goes back to v1, byte for byte.
  {
    const { context, page } = await fresh(browser, `${base}#c=${U_ROOM}`)
    await page.waitForSelector('[data-room]')
    await panel(page, 'Room')
    await page.getByTestId('remove-room').click()
    check((await code(page)) === '1UW188L132R132D44_bt32s36_la72_ra72.wh' && (await page.$('[data-room]')) === null, 'Remove: no room drawn, the v1 link again')
    await context.close()
  }

  // 4. Labels at three sizes (one light look since Phase 3b: no dark mode).
  for (const [vn, vp] of Object.entries(VIEWPORTS)) {
    for (const scheme of ['light']) {
      const { context, page } = await fresh(browser, `${base}#c=${U_ROOM}`, vp, scheme)
      await page.waitForSelector('[data-room]')
      await page.waitForTimeout(200)
      const lc = await labelCheck(page)
      check(lc.overlaps === 0 && lc.clipped === 0, `${vn} ${scheme}: ${lc.count} labels, ${lc.overlaps} overlapping, ${lc.clipped} clipped`)
      await page.screenshot({ path: `${SHOTS}/room-${vn}-${scheme}.png` })
      await context.close()
    }
  }
}
