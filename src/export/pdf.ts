// Sheet -> vector PDF and PNG (plan §9 "Pipeline"). Everything heavy loads
// here, on demand: jsPDF and svg2pdf.js through await import() (CLAUDE.md rule
// 4), the offscreen 3D renders through import('@/three/export').
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { buildHaven, buildLayout, rootConfig, teeOf, type Layout } from '@/engine';
import { SheetLayout, PAGE, type SheetViews } from './layout';
import { Sheet, type SheetRender } from './Sheet';

export interface SheetRequest {
  /** Shapes B1: the whole layout (one sofa, or a T). */
  layout: Layout;
  views: SheetViews;
  look: 'cad' | 'sketch';
  pillows: boolean;
  /** Typed at export time; never stored in the link. */
  title: string;
  link: string;
  date?: Date;
}

export interface SheetFile {
  pdf: Blob;
  /** The sheet as standalone SVG markup (for the PNG and for tests). */
  svg: string;
  name: string;
}

const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);

export function fileName(layout: Layout, title: string, date: Date, ext: string): string {
  const b = buildHaven(rootConfig(layout));
  const t = teeOf(layout);
  const shape = t ? 'T' : b.shape === 'U' ? 'U' : b.shape === 'L-left' ? 'L-left' : 'L-right';
  const size = t ? `${t.total}x${Math.max(...t.stem)}` : b.shape === 'U' ? `${b.W}x${b.L}x${b.R}` : `${b.W}x${b.shape === 'L-left' ? b.L : b.R}`;
  const day = date.toISOString().slice(0, 10);
  return [title ? slug(title) : 'Haven', shape, size, day].filter(Boolean).join('-') + `.${ext}`;
}

/** Renders the sheet into a detached element (createRoot + flushSync). */
function sheetElement(props: Parameters<typeof Sheet>[0]): { el: SVGSVGElement; markup: string } {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(Sheet, props)));
  const markup = host.innerHTML;
  root.unmount();
  const el = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
  return { el, markup };
}

export async function makeSheet(req: SheetRequest): Promise<SheetFile> {
  const config = rootConfig(req.layout);
  const built = buildHaven(config);
  const lb = buildLayout(req.layout);
  if (lb.exportBlocked) throw new Error('Fill the unfilled gaps first');
  // A T has no 3D until Shapes B2: its sheet is the plan alone.
  const views: SheetViews = lb.solo ? req.views : { plan: true, views: [] };
  const layout = new SheetLayout(views);
  const renders: SheetRender[] = [];
  if (layout.cells.length) {
    const { exportView } = await import('@/three/export');
    for (const cell of layout.cells) {
      const px = layout.renderPx(cell);
      const r = await exportView(config, cell.preset, px.w, px.h, { pillows: req.pillows });
      renders.push({ preset: cell.preset, url: r.url });
    }
  }
  const date = req.date ?? new Date();
  const { el, markup } = sheetElement({
    built,
    config,
    layout: req.layout,
    layoutBuild: lb,
    views,
    renders,
    look: req.look,
    meta: { title: req.title.trim(), date: date.toLocaleDateString('en-US', { dateStyle: 'long' }), link: req.link },
  });
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter', compress: true, putOnlyUsedFonts: true });
  await doc.svg(el, { x: 0, y: 0, width: PAGE.w, height: PAGE.h });
  const box = layout.linkBox(req.link);
  doc.link(box.x, box.y, box.w, box.h, { url: req.link });
  doc.viewerPreferences({ PrintScaling: 'None' });
  doc.setDocumentProperties({ title: req.title ? `Haven sectional: ${req.title}` : 'Haven sectional', creator: 'Haven Configurator' });
  return { pdf: doc.output('blob'), svg: markup, name: fileName(req.layout, req.title, date, 'pdf') };
}

/** The same sheet as a PNG at `dpi` (200 dpi = 2200 × 1700), for "send as image". */
export async function sheetPng(svg: string, dpi = 200): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('The sheet image failed to load'));
      img.src = url;
    });
    const k = dpi / 72;
    const c = document.createElement('canvas');
    c.width = Math.round(PAGE.w * k);
    c.height = Math.round(PAGE.h * k);
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
