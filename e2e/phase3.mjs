// UX Phase 3 checks (Andre, 2026-11-08; the app is shared over Zoom from a
// laptop): the top bar, "When pieces change", the result line, the shape
// guard, plain labels and the Room tab, seat width in Settings, the Phase 2
// leftovers, grips on the selected piece only, Dimensions Overall | Detailed,
// the keyboard, Fabric | Wood, the View menu, the cameras, one background,
// and no interface text under 14 px. Laptop sizes first (1440 × 900, 1280 × 800).
import { readFileSync } from 'node:fs'
import { VIEWPORTS } from './browser.mjs'
import { config, dimTexts, panel, selectPiece, setField, viewMenu } from './lib.mjs'

const SHOTS = 'test-results'
const LAPTOP = { width: 1440, height: 900 }
const LAPTOP_SMALL = { width: 1280, height: 800 }
const U_ROOM = '5UW188L132R132D44_bt32s36_la72_ra72_Mw240d200.zy'
/** An opened T (shapes.mjs): the one layout whose shape switch still starts fresh. */
const TEE = '3rW114.5L110R110D44_ba54.5_ra50_PglW114.5L110R110_ba54.5_la50.y2'

async function fresh(browser, base, viewport = LAPTOP, path = '') {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  if (!path.includes('#c=')) await page.getByTestId('new-standardU').click()
  await page.waitForSelector('[data-plan-svg]')
  await page.waitForTimeout(150)
  return { context, page, errors }
}
const result = (page) => page.$eval('[data-testid=result-text]', (e) => e.textContent).catch(() => null)
const undoDepth = (page) => page.evaluate(() => window.__haven.getState().past.length)

/** Visible HTML text under 14 px (the SVG plan has its own sizes). */
export const smallText = (page) =>
  page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg')) continue
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!own) continue
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('.sr-only')) continue
      if (parseFloat(cs.fontSize) < 14) out.push(`${el.textContent.trim().slice(0, 30)} (${cs.fontSize})`)
    }
    return out
  })

/** Save a screenshot and the same at half scale (how it reads through Zoom). */
export async function shot(browser, page, name) {
  const path = `${SHOTS}/${name}.png`
  await page.screenshot({ path })
  const vp = page.viewportSize()
  const p = await browser.newPage({ viewport: { width: Math.round(vp.width / 2), height: Math.round(vp.height / 2) } })
  await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${readFileSync(path).toString('base64')}" style="width:100%;display:block"></body>`)
  await p.waitForTimeout(100)
  await p.screenshot({ path: `${SHOTS}/${name}-half.png` })
  await p.close()
}

export async function phase3(browser, base, check) {
  // 1. Top bar, labels, tabs, settings, leftovers, text size.
  {
    const { context, page, errors } = await fresh(browser, base)
    check((await page.getByRole('button', { name: 'Start', exact: true }).count()) === 0, 'no "Start" in the top bar')
    check((await page.getByRole('button', { name: 'Undo', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Redo', exact: true }).count()) === 1, 'Undo and Redo arrows')
    check((await page.textContent('[data-testid=seats]')) === 'Seats 7', 'the seat count as text')
    check((await page.getByTestId('unsaved-dot').count()) === 0, 'no unsaved dot on a fresh layout')
    await page.getByTestId('project-name').click()
    const items = await page.$$eval('[data-testid=project-name-menu] [role=menuitem]', (els) => els.map((e) => e.textContent))
    check(items.join(' | ') === 'Reset to the Standard U | Start new…', `the name menu: ${items.join(' | ')}`)
    await page.keyboard.press('Escape')
    const labels = await page.$$eval('#panel-size label, #panel-size span', (els) => els.map((e) => e.textContent.trim()))
    check(['Width', 'Left side', 'Right side', 'Depth'].every((l) => labels.includes(l)), 'sofa labels: Width, Left side, Right side, Depth')
    const tabs = await page.$$eval('[role=tab]', (els) => els.map((e) => e.textContent.replace(/\d+$/, '')))
    check(tabs.join(' | ') === 'Size | Room | Pieces | Design', `tabs: ${tabs.join(' | ')}`)
    const panelText = await page.textContent('aside')
    check(!/Seat width|per seat|No warnings|from pieces|build|square/i.test(panelText), 'the Size tab: no seat width, "No warnings", "from pieces", build or "square"')
    await page.getByTestId('settings').click()
    check((await page.getByTestId('seat-width').count()) === 0 && (await page.getByTestId('build').count()) === 1, 'Settings: the build (the seat width moved to the View menu, 2026-11-09)')
    await page.keyboard.press('Escape')
    await panel(page, 'Room')
    const roomLabels = await page.$$eval('#panel-room label, #panel-room span', (els) => els.map((e) => e.textContent.trim()))
    check(roomLabels.includes('Room width') && roomLabels.includes('Room length'), 'the Room tab: Room width, Room length')
    await panel(page, 'Pieces')
    check(!(await page.textContent('aside')).includes('2″'), 'Pieces: no "2″ wood top"')
    check((await page.getByRole('radio', { name: 'Other seats adjust' }).getAttribute('aria-checked')) === 'true', 'Pieces: "When pieces change: Other seats adjust | Sofa size changes"')
    await panel(page, 'Design')
    const look = await page.$$eval('aside h2', (els) => els.map((e) => e.textContent))
    // Tables (Wood top on fabric base | All wood) joined Design on 2026-11-09; the Standard U has a table.
    check(look.join(' | ') === 'Shape | Fabric | Tables | Wood', `Design: Fabric, Tables and Wood (${look.join(' | ')})`)
    await panel(page, 'Size')
    for (const vp of [LAPTOP, LAPTOP_SMALL]) {
      await page.setViewportSize(vp)
      await page.waitForTimeout(150)
      const small = await smallText(page)
      check(small.length === 0, `${vp.width}×${vp.height}: no text under 14 px (${small.join('; ')})`)
    }
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. The result line, the lock wording, Save's dot, the keyboard.
  {
    const { context, page, errors } = await fresh(browser, base)
    await setField(page, 'W', 200)
    await page.waitForSelector('[data-testid=result-text]')
    check((await result(page)) === 'Width 188″ → 200″ · Seat 36″ → 48″', `result line: "${await result(page)}"`)
    check((await page.getByTestId('unsaved-dot').count()) === 1, 'Save shows the unsaved dot')
    await page.waitForTimeout(4000)
    check((await result(page)) !== null, 'the result line stays (no fade)')
    await page.getByTestId('result-undo').click()
    check((await config(page)).W === 188 && (await result(page)) === null, 'Undo inside the line: W back to 188, the line goes')
    await panel(page, 'Pieces')
    await page.getByRole('radio', { name: 'Sofa size changes' }).click()
    await page.waitForSelector('[data-testid=result-text]')
    check((await result(page)) === 'Sofa size changes' && (await config(page)).lockOutside === false, '"Sofa size changes" turns the lock off, and says so')
    await page.getByTestId('result-dismiss').click()
    check((await result(page)) === null, '× dismisses the line')
    // Keyboard.
    await page.mouse.click(5, 300)
    const d = await undoDepth(page)
    await page.keyboard.press('Control+z')
    check((await config(page)).lockOutside === true && (await undoDepth(page)) === d - 1, 'Ctrl+Z undoes')
    await page.keyboard.press('Control+Shift+z')
    check((await config(page)).lockOutside === false, 'Shift+Ctrl+Z redoes')
    await selectPiece(page, 'back', 1)
    await page.keyboard.press('Escape')
    check((await page.evaluate(() => window.__haven.getState().ui.selectedId)) === null, 'Esc deselects')
    await selectPiece(page, 'back', 1)
    await page.keyboard.press('Delete')
    check((await config(page)).runs.back.length === 1, 'Delete removes the selected piece')
    await page.keyboard.press('Control+z')
    check((await config(page)).runs.back.length === 2, '…and one Undo brings it back')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 3. The shape switch (Phase 3c, Andre 2026-11-09): an edited sofa converts in place, no guard; Undo brings it back.
  //    An opened T still starts fresh, asking first when it was edited (the guard).
  {
    const { context, page } = await fresh(browser, base)
    await setField(page, 'W', 200)
    await page.getByRole('radio', { name: 'L right' }).click()
    await page.waitForTimeout(200)
    check((await page.getByTestId('shape-guard').count()) === 0 && (await config(page)).shape === 'L-right', 'an edited sofa switches in place without asking')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check((await config(page)).shape === 'U' && (await config(page)).W === 200, 'Undo brings the edited U back')
    await page.goto(`${base}#c=${TEE}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    await setField(page, 'D', 40)
    await page.getByRole('radio', { name: 'Straight' }).click()
    await page.waitForSelector('[data-testid=shape-guard]')
    const title = await page.textContent('[role=dialog] h2')
    const desc = await page.textContent('[role=dialog] p')
    const buttons = await page.$$eval('[data-testid=shape-guard] button', (els) => els.map((e) => e.textContent))
    check(title === 'Switch to Straight?' && desc === 'This replaces your current layout.' && buttons.join(' | ') === 'Save first | Switch | Cancel', `an edited T: the guard "${title}" "${desc}" [${buttons.join(' | ')}]`)
    await page.getByTestId('guard-cancel').click()
    check((await page.evaluate(() => window.__haven.getState().layout.sections.length)) === 2, 'Cancel keeps the T')
    await page.getByRole('radio', { name: 'Straight' }).click()
    await page.getByTestId('guard-save').click()
    await page.getByTestId('save-name').fill('Guard test')
    await page.getByTestId('save-confirm').click()
    await page.waitForTimeout(150)
    const saved = await page.evaluate(() => window.__haven.getState().ui.project?.name)
    check(saved === 'Guard test' && (await config(page)).shape === 'straight', `Save first: saved "${saved}", then switched`)
    await context.close()
  }

  // 4. Grips on the selected piece only; Dimensions Overall | Detailed (kept per device); View menu; cameras; one background.
  {
    const { context, page } = await fresh(browser, base, LAPTOP, `#c=${U_ROOM}`)
    check((await page.$$('[data-grip]')).length === 0, 'no grips with nothing selected')
    await selectPiece(page, 'back', 1)
    const grips = await page.$$eval('[data-grip]', (els) => els.map((e) => e.getAttribute('data-grip')))
    check(grips.join(',') === 'back:1', `the back seat selected: its one seam grip (${grips.join(',')})`)
    await page.keyboard.press('Escape')
    const detailed = await dimTexts(page)
    await page.getByRole('radio', { name: 'Overall' }).click()
    const overall = await dimTexts(page)
    check(detailed.includes('32"') && !overall.includes('32"') && overall.includes(`188" (15'-8")`), 'Overall: the outside sizes only (no piece chain)')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    check((await page.getAttribute('[data-plan-svg]', 'data-dims-mode')) === 'overall', 'Overall is kept after a reload (this device)')
    await shot(browser, page, 'phase3-overall-1440')
    await page.getByRole('radio', { name: 'Detailed' }).click()
    await viewMenu(page)
    check((await page.getByRole('menuitemcheckbox', { name: 'Pillows' }).count()) === 1 && (await page.getByRole('radio', { name: 'Sketch' }).count()) === 1, 'the View menu: Pillows, Plan style')
    await page.keyboard.press('Escape')
    const bg = await page.evaluate(() => [document.querySelector('[data-plan-svg] > rect').getAttribute('fill'), document.querySelector('[data-room] rect').getAttribute('fill')])
    check(bg[0] === bg[1], `plan and room floor share one background (${bg.join(', ')})`)
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    const cams = await page.$$eval('[data-testid=presets] [role=radio]', (els) => els.map((e) => e.textContent))
    check(cams.join(' | ') === 'Overview | Top | Front | Side', `cameras: ${cams.join(' | ')}`)
    await page.waitForTimeout(1500)
    const px = await page.evaluate(async () => {
      const img = new Image()
      img.src = window.__haven3d.capture()
      await img.decode()
      const g = document.createElement('canvas')
      g.width = img.width
      g.height = img.height
      const x = g.getContext('2d')
      x.drawImage(img, 0, 0)
      return [...x.getImageData(4, 4, 1, 1).data.slice(0, 3)]
    })
    const hex = '#' + px.map((v) => v.toString(16).padStart(2, '0')).join('')
    check(Math.abs(px[0] - 0xfa) <= 3 && Math.abs(px[1] - 0xf8) <= 3 && Math.abs(px[2] - 0xf4) <= 3, `the 3D background matches the plan (${hex} vs ${bg[0]})`)
    await shot(browser, page, 'phase3-3d-1440')
    await context.close()
  }

  // 5. Screenshots (laptop first; iPad and phone still work), each also at half scale.
  for (const [name, vp] of [['1440', LAPTOP], ['1280', LAPTOP_SMALL], ['ipadLandscape', VIEWPORTS.ipadLandscape], ['phone', VIEWPORTS.phone]]) {
    const { context, page } = await fresh(browser, base, vp, `#c=${U_ROOM}`)
    await setField(page, 'W', 200).catch(() => {})
    await page.waitForTimeout(200)
    await shot(browser, page, `phase3-${name}`)
    await context.close()
  }
}
