// Share & PDF (plan §9, Andre 2026-09-26: "easy to make into a PDF, download
// and share on the iPad; the top CAD view and the 3D views I tick").
// Two taps on the iPad: "Make PDF" (async), then "Share PDF" (fresh user
// activation for navigator.share). Also the two links: view-only and editable.
// Lazy-loaded; the PDF stack loads only on "Make PDF".
import { useEffect, useState } from 'react';
import type { PresetName } from '@/ortho/presets';
import { KEYS, readJson, writeItem } from '@/state/storage';
import { builtOf, useHaven, useHavenStore } from '@/state/store';
import { shareLinks } from '@/state/url';
import { Button, Segmented } from './controls';
import { Dialog } from './Dialog';

type Views = { plan: boolean } & Record<'threeQuarter' | 'iso' | 'front' | 'side', boolean>;
const DEFAULT_VIEWS: Views = { plan: true, threeQuarter: true, iso: false, front: false, side: false };
const VIEW_LABELS: { key: keyof Views; label: string }[] = [
  { key: 'plan', label: 'Plan with measurements (to scale)' },
  { key: 'threeQuarter', label: '3/4 view' },
  { key: 'iso', label: 'Iso view' },
  { key: 'front', label: 'Front view' },
  { key: 'side', label: 'Side view' },
];

type Made = { pdf: Blob; svg: string; name: string; preview: string; sig: string };

export default function ShareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useHavenStore();
  const config = useHaven((s) => s.config);
  const uiLook = useHaven((s) => s.ui.look);
  const pillows = useHaven((s) => s.ui.pillows);
  const [views, setViews] = useState<Views>(() => ({ ...DEFAULT_VIEWS, ...readJson<Partial<Views>>(KEYS.sheetViews) }));
  const [look, setLook] = useState<'cad' | 'sketch'>(uiLook);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [madeState, setMade] = useState<Made | null>(null);
  const [error, setError] = useState<string | null>(null);
  const links = shareLinks(config);
  const blocked = builtOf(config).exportBlocked;
  const chosen = VIEW_LABELS.filter((v) => views[v.key]);

  // A new layout or new choices make the old PDF stale.
  const sig = JSON.stringify([links.edit, views, look, title, pillows]);
  const made = madeState && madeState.sig === sig ? madeState : null;
  useEffect(() => () => (madeState ? URL.revokeObjectURL(madeState.preview) : undefined), [madeState]);

  const toggle = (k: keyof Views) => {
    const next = { ...views, [k]: !views[k] };
    setViews(next);
    writeItem(KEYS.sheetViews, JSON.stringify(next));
  };

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const { makeSheet } = await import('@/export/pdf');
      const r = await makeSheet({
        config,
        views: { plan: views.plan, views: (['threeQuarter', 'iso', 'front', 'side'] as PresetName[]).filter((k) => views[k as keyof Views]) },
        look,
        pillows,
        title,
        link: links.view,
      });
      setMade({ ...r, sig, preview: URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' })) });
    } catch (e) {
      setError((e as Error).message || 'The PDF could not be made');
    } finally {
      setBusy(false);
    }
  };

  const toast = (t: string) => store.getState().toast(t);
  const share = async () => {
    if (!made) return;
    const { shareFile } = await import('@/export/share');
    const r = await shareFile(made.pdf, made.name);
    if (r === 'downloaded') toast(`Downloaded ${made.name}`);
  };
  const png = async () => {
    if (!made) return;
    const [{ sheetPng }, { shareFile }] = await Promise.all([import('@/export/pdf'), import('@/export/share')]);
    await shareFile(await sheetPng(made.svg), made.name.replace(/\.pdf$/, '.png'));
  };
  const sendLink = async (url: string, what: string) => {
    const { shareLink } = await import('@/export/share');
    const r = await shareLink(url, 'Haven sectional');
    if (r === 'copied') toast(`${what} copied`);
    else if (r === 'failed') toast('Could not share or copy the link');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share & PDF" description="A one-page sheet (Letter): the plan to scale, plus the 3D views you tick.">
      <fieldset className="flex flex-col gap-1" data-testid="sheet-views">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">On the sheet</legend>
        {VIEW_LABELS.map((v) => (
          <label key={v.key} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={views[v.key]} onChange={() => toggle(v.key)} data-view={v.key} />
            {v.label}
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <span className="text-sm">Plan style</span>
        <div className="flex-1">
          <Segmented label="Sheet plan style" value={look} options={[{ value: 'cad', label: 'CAD' }, { value: 'sketch', label: 'Sketch' }]} onChange={setLook} />
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Client or project (optional, printed on the sheet only)
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className="h-11 rounded-lg border border-line bg-panel px-3 text-base" placeholder="e.g. Mitchell residence" />
      </label>
      {blocked && <p className="text-sm text-danger">Fill the unfilled gaps first: the sheet needs a complete sofa.</p>}
      {!made ? (
        <Button tone="primary" disabled={busy || blocked || chosen.length === 0} onClick={make} data-testid="make-pdf">
          {busy ? 'Making the PDF…' : 'Make PDF'}
        </Button>
      ) : (
        <div className="flex flex-col gap-2" data-testid="made">
          <img src={made.preview} alt="The sheet" className="w-full rounded-lg border border-line bg-white" />
          <div className="grid grid-cols-2 gap-2">
            <Button tone="primary" onClick={share} data-testid="share-pdf">
              Share / download PDF
            </Button>
            <Button onClick={png}>Image (PNG)</Button>
          </div>
          <p className="text-xs text-ink-muted">{made.name}</p>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Send the layout as a link</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => sendLink(links.view, 'View-only link')} data-testid="share-view-link">
            View-only link
          </Button>
          <Button onClick={() => sendLink(links.edit, 'Editable link')}>Editable link</Button>
        </div>
        <p className="text-xs text-ink-muted">Links carry the sofa only: never names or prices.</p>
      </div>
    </Dialog>
  );
}
