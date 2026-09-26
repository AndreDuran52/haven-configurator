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
