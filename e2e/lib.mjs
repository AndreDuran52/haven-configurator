// Shared e2e helpers: open the app, read the plan's DOM, drive the inputs.
import { openPage, VIEWPORTS } from './browser.mjs'

export function reporter() {
  const failures = []
  const check = (ok, label) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
    if (!ok) failures.push(label)
  }
  return { check, failures }
}

/** Open the app at `path` in a fresh context (clean storage) and wait for the plan. */
export async function openApp(browser, base, path = '', viewport = VIEWPORTS.ipadLandscape, init) {
  const { context, page, errors } = await openPage(browser, base + path, viewport, init)
  await page.waitForSelector('[data-plan-svg]')
  return { context, page, errors }
}

export const dimTexts = (page) => page.$$eval('[data-dim-text]', (els) => els.map((e) => e.textContent))
export const seats = (page) => page.textContent('[data-testid=seats]')
export const warnings = (page) => page.$$eval('[data-testid=warnings] li', (els) => els.map((e) => e.textContent))
export const config = (page) => page.evaluate(() => window.__haven.getState().config)

/** Open a side-panel tab: 'Size', 'Room', 'Pieces' or 'Design' (editor redesign, 2026-11-06; Room since UX Phase 3; Look became Design in 3b). */
export async function panel(page, name) {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
  // Room, Pieces and Design load on first open: wait for their content.
  const content = { Size: '#m-D', Room: '#m-roomW', Pieces: '[data-tray]', Design: '[data-testid=fabrics]' }[name]
  await page.waitForSelector(content, { timeout: 10000 })
  await page.waitForTimeout(50)
}

/** Type into a measurement field and commit with Enter (blur). */
export async function setField(page, name, value) {
  const input = page.locator(`#m-${name}`)
  await input.click()
  await input.fill(String(value))
  await input.press('Enter')
  await page.waitForTimeout(60)
}

/** Press a key on the wedge slider thumb `times` times (each press commits). */
export async function slide(page, key, times) {
  const thumb = page.getByRole('slider', { name: /^Wedge/ })
  await thumb.focus()
  for (let i = 0; i < times; i++) await thumb.press(key)
  await page.waitForTimeout(60)
}

/** Count plan labels that overlap each other or are clipped by the plan's edges. */
export function labelCheck(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-plan-svg]').getBoundingClientRect()
    const boxes = [...document.querySelectorAll('[data-plan-svg] text')].map((e) => e.getBoundingClientRect())
    let overlaps = 0
    let clipped = 0
    boxes.forEach((a, i) => {
      if (a.left < svg.left - 0.5 || a.right > svg.right + 0.5 || a.top < svg.top - 0.5 || a.bottom > svg.bottom + 0.5) clipped++
      for (const b of boxes.slice(i + 1)) {
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (w > 0.5 && h > 0.5) overlaps++
      }
    })
    return { overlaps, clipped, count: boxes.length }
  })
}

/** UX Phase 3: the project name's menu (Rename, Reset, Start new). `item`: 'rename' | 'reset' | 'start'. */
export async function projectMenu(page, item) {
  await page.getByTestId('project-name').click()
  await page.getByTestId(`menu-${item}`).click()
}

/** UX Phase 3: the View menu over the plan (Pillows in 3D, Plan style). Leaves it open. */
export async function viewMenu(page) {
  if (!(await page.getByTestId('view-menu-menu').count())) await page.getByTestId('view-menu').click()
  await page.waitForSelector('[data-testid=view-menu-menu]')
}

/** UX Phase 3: the camera bar shows Overview, Front, Side; Top and Iso stay reachable for the checks. */
export async function preset(page, name) {
  await page.evaluate((n) => window.__haven.getState().setUi({ preset: n }), name)
}

/** UX Phase 3: grips show on the selected piece only. Select a piece of the edited section (by its run and index). */
export async function selectPiece(page, run, index) {
  await page.evaluate(([r, i]) => {
    const s = window.__haven.getState()
    s.setUi({ selectedId: s.config.runs[r][i].id })
  }, [run, index])
  await page.waitForTimeout(80)
}
