// Renders the app icons in public/icons/ from one SVG, with the Chromium that
// e2e uses (HAVEN_CHROMIUM). Run by hand when the icon changes:
//   HAVEN_CHROMIUM=/opt/pw-browsers/chromium node scripts/make-icons.mjs
// iOS caches the home-screen icon when it is added: re-add it after changes.
import { writeFileSync } from 'node:fs'
import { launchBrowser } from '../e2e/browser.mjs'

// A plan-view U sectional (the Haven's signature shape) on the accent colour.
// `inset` shrinks the artwork into the maskable safe zone (inner 80 %).
function svg(size, { inset = 0, radius = 0 } = {}) {
  const s = 512
  const pad = 112 + inset
  const w = s - 2 * pad
  const t = w * 0.26 // arm/back depth
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${radius}" fill="#8a5a3b"/>
  <path fill="#f6f3ee" d="M${pad} ${pad}h${w}v${w}h${-t}v${-(w - t)}h${-(w - 2 * t)}v${w - t}h${-t}z"/>
</svg>`
}

const ICONS = [
  { file: 'icon-192.png', size: 192, opts: { radius: 96 } },
  { file: 'icon-512.png', size: 512, opts: { radius: 96 } },
  { file: 'maskable-512.png', size: 512, opts: { inset: 40 } },
  // iOS applies its own rounded mask; a full-bleed square looks right there.
  { file: 'apple-touch-icon-180.png', size: 180, opts: {} },
]

const browser = await launchBrowser()
try {
  const page = await browser.newPage()
  for (const { file, size, opts } of ICONS) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(size, opts)}`,
    )
    const png = await page.locator('svg').screenshot({ omitBackground: true })
    writeFileSync(`public/icons/${file}`, png)
    console.log(`public/icons/${file} (${size}×${size})`)
  }
} finally {
  await browser.close()
}
