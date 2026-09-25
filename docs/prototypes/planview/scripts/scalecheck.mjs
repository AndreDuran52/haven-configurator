import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'
for (const [f, S] of [['pdf/standardU-shop-cad.pdf', 72 / 32], ['pdf/w300-shop-cad.pdf', 72 / 48]]) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)), useSystemFonts: false }).promise
  const page = await doc.getPage(1)
  const tc = await page.getTextContent()
  const sixties = tc.items.filter((t) => t.str === '60"' && Math.abs(t.transform[1]) < 1e-6) // horizontal ones
  const xs = sixties.map((t) => t.transform[4]).sort((a, b) => a - b)
  const W = f.includes('w300') ? 300 : 188
  console.log(f, 'horizontal 60" label x:', xs.map((x) => x.toFixed(2)).join(', '), '→ measured Δ', (xs.at(-1) - xs[0]).toFixed(2), 'pt; expected (W−60)·S =', ((W - 60) * S).toFixed(2), 'pt')
}
