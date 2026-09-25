// Shared Playwright helpers (playwright-core + the pre-installed Chromium; never `playwright install`).
import { chromium } from 'playwright-core'

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5199/'
export const VIEWPORTS = {
  ipadLandscape: { width: 1180, height: 820 },
  ipadPortrait: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
}

export async function launch() {
  return chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    headless: true,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  })
}

export async function openPage(browser, viewport, query, { dpr = 1, log = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: true })
  const page = await ctx.newPage()
  const messages = []
  page.on('console', (m) => messages.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message}`))
  await page.goto(BASE + (query ? `?${query}` : ''))
  await page.waitForFunction(() => !!window.__haven, null, { timeout: 30000 })
  await settle(page)
  if (log) page._haven_messages = messages
  return { ctx, page, messages }
}

/** Wait until camera-controls reports rest and a few frames have rendered. */
export async function settle(page, timeout = 15000) {
  await page.waitForFunction(
    () => {
      const s = window.__haven?.state()
      return s && s.frames >= 1 && s.resting
    },
    null,
    { timeout, polling: 100 },
  )
  await page.waitForTimeout(150)
}
