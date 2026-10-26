// Saved projects as cards on the Projects home (H6b; the Start menu list of
// H6): a small plan, the name and date; open (tap the card), rename, duplicate,
// share link, delete (asks first). Per device: the installed app and Safari keep
// separate lists, so every card can send its link, and the home has Back up.
import { useState } from 'react';
import { encode, type Config } from '@/engine';
import { deleteSaved, duplicateSaved, openSaved, renameSaved, saveFailure, savedDate, type SavedLayout } from '@/state/savedLayouts';
import { shareLinks } from '@/state/url';
import { Button } from './controls';
import { PlanThumb } from './PlanThumb';

export type OpenProject = (c: Config, project: { id: string; name: string; code: string }) => void;

export function SavedList({ list, onChange, onOpen, onToast }: { list: SavedLayout[]; onChange: () => void; onOpen: OpenProject; onToast: (t: string) => void }) {
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!list.length) return <p className="text-sm text-ink-muted">No saved projects on this device yet. Start a new Haven, then use Save.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="saved-list">
      {list.map((e) => {
        const config = openSaved(e);
        const open = () => (config ? onOpen(config, { id: e.id, name: e.name, code: encode(config) }) : onToast('This saved project looks damaged'));
        return (
          <li key={e.id} className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-2" data-saved={e.name}>
            <button type="button" onClick={open} className="h-36 rounded-lg bg-white p-1" aria-label={`Open ${e.name}`}>
              {config ? <PlanThumb config={config} /> : <span className="text-sm text-danger">Damaged</span>}
            </button>
            {renaming?.id === e.id ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={renaming.name}
                  onChange={(ev) => setRenaming({ id: e.id, name: ev.target.value })}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 text-base"
                  aria-label="New name"
                />
                <Button
                  tone="primary"
                  onClick={() => {
                    if (!renameSaved(e.id, renaming.name)) onToast("Can't save on this device");
                    setRenaming(null);
                    onChange();
                  }}
                >
                  OK
                </Button>
              </div>
            ) : (
              <div className="flex items-baseline justify-between gap-2 px-1">
                <span className="truncate font-semibold">{e.name}</span>
                <span className="shrink-0 text-xs text-ink-muted">{savedDate(e.savedAt)}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              <Button tone="primary" onClick={open}>
                Open
              </Button>
              <Button tone="quiet" onClick={() => setRenaming({ id: e.id, name: e.name })}>
                Rename
              </Button>
              <Button
                tone="quiet"
                onClick={() => {
                  if (!duplicateSaved(e.id)) onToast(saveFailure());
                  onChange();
                }}
              >
                Duplicate
              </Button>
              <Button
                tone="quiet"
                onClick={async () => {
                  if (!config) return;
                  const { shareLink } = await import('@/export/share');
                  const r = await shareLink(shareLinks(config).edit, e.name);
                  if (r === 'copied') onToast('Link copied');
                }}
              >
                Share link
              </Button>
              {confirm === e.id ? (
                <>
                  <Button
                    className="text-danger"
                    onClick={() => {
                      deleteSaved(e.id);
                      setConfirm(null);
                      onChange();
                    }}
                  >
                    Delete "{e.name}"
                  </Button>
                  <Button tone="quiet" onClick={() => setConfirm(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button tone="quiet" className="text-danger" onClick={() => setConfirm(e.id)}>
                  Delete
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
