// Inch formatting for dimension labels. Straight quotes on purpose: the PDF
// standard-14 fonts (WinAnsiEncoding) have " ' × ½ – but NOT ″ ′ (U+2033/2032).

export function fmtIn(x: number, opts: { mark?: boolean } = {}): string {
  const mark = opts.mark ?? true
  const whole = Math.floor(x + 1e-9)
  const frac = x - whole
  const body = frac > 0.25 && frac < 0.75 ? (whole === 0 ? '½' : `${whole}½`) : `${Math.round(x)}`
  return mark ? `${body}"` : body
}

/** 188 -> 15'-8"  (architectural feet-inches, used as a secondary label on overalls). */
export function fmtFtIn(x: number): string {
  const ft = Math.floor(x / 12 + 1e-9)
  const inch = x - ft * 12
  return `${ft}'-${fmtIn(inch)}`
}
