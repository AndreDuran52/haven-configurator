// Browser harness: sheet SVG -> vector PDF (jsPDF + svg2pdf.js) and -> PNG (canvas).
import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildHaven } from '../src/engine/buildHaven'
import { fixtures } from '../src/fixtures'
import { PAGE, PieceListPage, Sheet, type SheetProps } from '../src/export/Sheet'
// esbuild loaders: .png -> dataurl, .ttf -> base64
import frontPng from '../assets/export-front-6ppi.png'
import isoPng from '../assets/export-trimetric-6ppi.png'
import dejavuB64 from '../assets/DejaVuSans.ttf'

declare global {
  interface Window {
    makePdf: (name: string, kind: 'client' | 'shop', opts?: { look?: 'cad' | 'sketch'; embedFont?: boolean; jpeg?: boolean }) => Promise<{ b64: string; ms: number; bytes: number }>
    makePng: (name: string, dpi: number) => Promise<{ b64: string; ms: number; w: number; h: number }>
    sheetSvg: (name: string, kind: 'client' | 'shop') => string
  }
}

function props(name: string, kind: 'client' | 'shop', look: 'cad' | 'sketch' = 'cad'): SheetProps {
  const config = fixtures()[name]!
  const built = buildHaven(config)
  return {
    kind,
    built,
    config,
    look,
    meta: { client: 'Mitchell residence', project: 'Family room', date: '2026-09-24', link: 'venegas-tracker.vercel.app/haven?c=…' },
    // ortho-demo export contract: 6 px/in, 4" pad, front view covers x -4..192, z -4..31
    frontRender: kind === 'client' ? { url: frontPng, pxW: 1176, pxH: 210, pxPerInch: 6, u0: -4, z0: -4 } : undefined,
    isoRender: kind === 'client' ? { url: isoPng, pxW: 1421, pxH: 813 } : undefined,
  }
}

window.sheetSvg = (name, kind) => renderToStaticMarkup(<Sheet {...props(name, kind)} />)

function toEl(markup: string): SVGSVGElement {
  // parsed, detached element: no Tailwind classes / CSS variables can leak in
  return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement as unknown as SVGSVGElement
}

window.makePdf = async (name, kind, opts = {}) => {
  const t0 = performance.now()
  const p = props(name, kind, opts.look)
  if (opts.jpeg) {
    const toJpeg = async (url: string) => {
      const img = new Image()
      await new Promise<void>((r) => { img.onload = () => r(); img.src = url })
      const c = document.createElement('canvas')
      c.width = img.naturalWidth; c.height = img.naturalHeight
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0)
      return c.toDataURL('image/jpeg', 0.85)
    }
    if (p.frontRender) p.frontRender = { ...p.frontRender, url: await toJpeg(p.frontRender.url) }
    if (p.isoRender) p.isoRender = { ...p.isoRender, url: await toJpeg(p.isoRender.url) }
  }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter', compress: true, putOnlyUsedFonts: true })
  let markup = renderToStaticMarkup(<Sheet {...p} />)
  if (opts.embedFont) {
    doc.addFileToVFS('DejaVuSans.ttf', dejavuB64)
    doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal')
    doc.addFont('DejaVuSans.ttf', 'DejaVu', 'bold') // no bold file here: reuse regular to prove the mapping
    markup = markup.replaceAll('font-family="Helvetica, sans-serif"', 'font-family="DejaVu, sans-serif"')
    // prove glyph coverage beyond WinAnsi: true inch/foot primes
    markup = markup.replace('</svg>', '<text x="40" y="24" font-size="9" font-family="DejaVu">primes: 15′-8″ · 13½″ · 44″D</text></svg>')
  }
  await doc.svg(toEl(markup), { x: 0, y: 0, width: PAGE.w, height: PAGE.h })
  if (kind === 'shop') {
    doc.addPage('letter', 'landscape')
    await doc.svg(toEl(renderToStaticMarkup(<PieceListPage built={p.built} config={p.config} meta={p.meta} />)), { x: 0, y: 0, width: PAGE.w, height: PAGE.h })
  }
  doc.viewerPreferences({ PrintScaling: 'None' })
  doc.setDocumentProperties({ title: `Haven ${kind} sheet`, creator: 'Venegas Designs configurator' })
  const buf = doc.output('arraybuffer')
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return { b64: btoa(s), ms: Math.round(performance.now() - t0), bytes: bytes.length }
}

window.makePng = async (name, dpi) => {
  const t0 = performance.now()
  const markup = renderToStaticMarkup(<Sheet {...props(name, 'client')} />)
  const blob = new Blob([markup], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('svg image failed'))
    img.src = url
  })
  const scale = dpi / 72
  const c = document.createElement('canvas')
  c.width = Math.round(PAGE.w * scale)
  c.height = Math.round(PAGE.h * scale)
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  const out = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'))
  const ab = new Uint8Array(await out.arrayBuffer())
  let s = ''
  for (let i = 0; i < ab.length; i++) s += String.fromCharCode(ab[i]!)
  return { b64: btoa(s), ms: Math.round(performance.now() - t0), w: c.width, h: c.height }
}
