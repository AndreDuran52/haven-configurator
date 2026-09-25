// Inch formatting for dimension labels, and parsing typed measurements.
// Straight quotes on purpose: the PDF standard-14 fonts (WinAnsiEncoding) have
// " ' × ½ – but NOT ″ ′ (U+2033/2032).

export function fmtIn(x: number, opts: { mark?: boolean } = {}): string {
  const mark = opts.mark ?? true;
  const whole = Math.floor(x + 1e-9);
  const frac = x - whole;
  const body = frac > 0.25 && frac < 0.75 ? (whole === 0 ? '½' : `${whole}½`) : `${Math.round(x)}`;
  return mark ? `${body}"` : body;
}

/** 188 -> 15'-8"  (architectural feet-inches, used as a secondary label on overalls). */
export function fmtFtIn(x: number): string {
  const ft = Math.floor(x / 12 + 1e-9);
  const inch = x - ft * 12;
  return `${ft}'-${fmtIn(inch)}`;
}

/**
 * Parse a typed measurement in inches (plan §8 MeasureField). Accepts `188`,
 * `188.5`, `188 1/2`, `188½`, `188"`, `15'8"`, `15' 8 1/2"`, `15'-8"` and `15'`.
 * Returns null for anything else (the field keeps its value).
 */
export function parseInches(input: string): number | null {
  const s = input
    .trim()
    .replace(/[″”]/g, '"')
    .replace(/[′’]/g, "'")
    .replace(/½/g, ' 1/2')
    .replace(/\s+/g, ' ');
  if (!s) return null;
  const inchPart = (t: string): number | null => {
    const m = /^(?:(\d+(?:\.\d+)?)(?: (\d+)\/(\d+))?|(\d+)\/(\d+))$/.exec(t.trim());
    if (!m) return null;
    if (m[4] !== undefined) return Number(m[5]) === 0 ? null : Number(m[4]) / Number(m[5]);
    const whole = Number(m[1]);
    if (m[2] === undefined) return whole;
    return Number(m[3]) === 0 ? null : whole + Number(m[2]) / Number(m[3]);
  };
  const feet = /^(\d+(?:\.\d+)?) ?' ?-? ?(.*?) ?"?$/.exec(s);
  if (feet) {
    const rest = feet[2]!.trim();
    const inches = rest === '' ? 0 : inchPart(rest);
    return inches === null ? null : Number(feet[1]) * 12 + inches;
  }
  return inchPart(s.replace(/ ?"$/, ''));
}
