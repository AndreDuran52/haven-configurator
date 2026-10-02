// Delivery (plan §9; H6b, Andre 2026-10-02: "download or print are the main
// ones we use"): Download and Print first, the share sheet only on "Share…".
// Called from a tap AFTER generation, so the tap's user activation is still
// fresh (the "two taps" of the plan: Make PDF, then Download / Print / Share).
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const canShareFiles = (): boolean => {
  try {
    const probe = new File([new Blob(['x'])], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
};

/** iPadOS reports itself as a Mac; a Mac has no touch points. */
export const isIOS = (): boolean =>
  /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const PRINT_LOAD_MS = 10_000;

/**
 * Print the PDF. Laptop: a hidden same-origin iframe holding the PDF, then its
 * print dialog. iPad/iPhone: printing a frame is unreliable there, so the share
 * sheet (its "Print" row) or, without one, the PDF in a new tab.
 * UNVERIFIED on a real iPad and on Safari for Mac.
 */
export async function printPdf(blob: Blob, name: string): Promise<'printing' | 'shared' | 'opened' | 'cancelled' | 'failed'> {
  if (isIOS()) {
    if (canShareFiles()) {
      const r = await shareFile(blob, name, false);
      if (r !== 'failed') return r === 'shared' ? 'shared' : 'cancelled';
    }
    return openPdf(blob);
  }
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.dataset.print = name;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  const cleanup = () => window.setTimeout(() => (frame.remove(), URL.revokeObjectURL(url)), 60_000);
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      window.setTimeout(() => reject(new Error('timeout')), PRINT_LOAD_MS);
    });
    frame.src = url;
    document.body.appendChild(frame);
    await loaded;
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    cleanup();
    return 'printing';
  } catch {
    frame.remove();
    URL.revokeObjectURL(url);
    return openPdf(blob);
  }
}

/** The PDF in a new tab (its viewer has Print and Save). */
function openPdf(blob: Blob): 'opened' | 'failed' {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return w ? 'opened' : 'failed';
}

/** 'shared' | 'downloaded' | 'cancelled' (| 'failed' when `orDownload` is off and the sheet could not open) */
export async function shareFile(blob: Blob, name: string, orDownload = true): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const file = new File([blob], name, { type: blob.type });
  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // NotAllowedError (activation expired) and friends: fall back to a download.
    }
  }
  if (!orDownload) return 'failed';
  download(blob, name);
  return 'downloaded';
}

/** A link through the share sheet, or the clipboard. */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'failed';
    }
  }
  return copyText(url);
}

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
