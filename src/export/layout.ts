// Where things go on the sheet (Letter landscape, points). Pure, so the PDF
// step (clickable link), the renders (their pixel size) and tests agree.
import type { PresetName } from '@/ortho/presets';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Andre's checkboxes: the plan with measurements, and any 3D views. */
export interface SheetViews {
  plan: boolean;
  views: PresetName[];
}

export const PAGE = { w: 792, h: 612, margin: 28 };
const HEADER_H = 42;
const FOOTER_H = 40;
const GAP = 14;
const LABEL_H = 14;
/** Render resolution for the 3D views: about 216 dpi on paper. */
export const RENDER_PX_PER_PT = 3;

export class SheetLayout {
  readonly page = { w: PAGE.w, h: PAGE.h };
  readonly header: Box;
  readonly footer: Box;
  readonly body: Box;
  readonly plan: Box | null;
  readonly cells: (Box & { preset: PresetName })[];

  constructor(v: SheetViews) {
    const m = PAGE.margin;
    const w = PAGE.w - 2 * m;
    this.header = { x: m, y: m, w, h: HEADER_H };
    this.footer = { x: m, y: PAGE.h - m - FOOTER_H, w, h: FOOTER_H };
    const top = m + HEADER_H + GAP;
    this.body = { x: m, y: top, w, h: this.footer.y - GAP - top };
    const n = v.views.length;
    const b = this.body;
    let viewsBox: Box | null = null;
    if (v.plan && n) {
      const planW = n >= 3 ? b.w * 0.55 : b.w * 0.6;
      this.plan = { x: b.x, y: b.y, w: planW - GAP / 2, h: b.h };
      viewsBox = { x: b.x + planW + GAP / 2, y: b.y, w: b.w - planW - GAP / 2, h: b.h };
    } else if (v.plan) {
      this.plan = b;
    } else {
      this.plan = null;
      viewsBox = b;
    }
    this.cells = [];
    if (viewsBox && n) {
      const vb = viewsBox;
      // One column beside the plan for 1–2 views; a 2 × 2 grid for 3–4, or on their own.
      const cols = n >= 3 || (!v.plan && n === 2) ? 2 : 1;
      const rows = Math.ceil(n / cols);
      const cw = (vb.w - GAP * (cols - 1)) / cols;
      const ch = (vb.h - GAP * (rows - 1)) / rows;
      v.views.forEach((preset, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        this.cells.push({ preset, x: vb.x + c * (cw + GAP), y: vb.y + r * (ch + GAP), w: cw, h: ch });
      });
    }
  }

  /** The image area of a view cell (under its label). */
  image(cell: Box): Box {
    return { x: cell.x, y: cell.y + LABEL_H, w: cell.w, h: cell.h - LABEL_H };
  }

  /** Render size in px for a cell. */
  renderPx(cell: Box): { w: number; h: number } {
    const img = this.image(cell);
    const k = Math.min(RENDER_PX_PER_PT, 1600 / Math.max(img.w, img.h));
    return { w: Math.round(img.w * k), h: Math.round(img.h * k) };
  }

  /** The clickable link in the footer (right-aligned text). */
  get linkBox(): Box {
    return { x: this.footer.x + this.footer.w - 260, y: this.footer.y + 4, w: 260, h: 22 };
  }
}
