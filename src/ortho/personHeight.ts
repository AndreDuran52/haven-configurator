// Heights as people say them (the View menu's Person section). Pure.

/** 69 -> 5'9″ */
export const feetInches = (inches: number): string => `${Math.floor(Math.round(inches) / 12)}'${Math.round(inches) % 12}″`;

/** "5'9", "5 9", "5ft 9", "69", "69in" -> inches; null when it is not a height. */
export function parseHeight(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/[″"]|in(ches)?$/g, '').trim();
  const m = /^(\d)\s*(?:'|ft|feet|\s)\s*(\d{1,2})?$/.exec(s);
  if (m) return Number(m[1]) * 12 + Number(m[2] ?? 0);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
