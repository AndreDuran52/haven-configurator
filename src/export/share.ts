// Delivery (plan §9): the iPad share sheet when it can take files, else a
// download. Called from a tap AFTER generation, so the tap's user activation is
// still fresh (the "two taps" of the plan: Make PDF, then Share).
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

/** 'shared' | 'downloaded' | 'cancelled' */
export async function shareFile(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
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
