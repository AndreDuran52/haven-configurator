// Saved layouts in the Start menu: open, rename, duplicate, delete (asks
// first), share link. Per device: the installed app and Safari keep separate
// lists, so every row can send its link (the cross-device path).
import { useState } from 'react';
import type { Config } from '@/engine';
import { deleteSaved, duplicateSaved, listSaved, openSaved, renameSaved, type SavedLayout } from '@/state/savedLayouts';
import { shareLinks } from '@/state/url';
import { Button } from './controls';

export function SavedList({ onOpen, onToast }: { onOpen: (c: Config, name: string) => void; onToast: (t: string) => void }) {
  const [list, setList] = useState<SavedLayout[]>(() => listSaved());
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const refresh = () => setList(listSaved());
  if (!list.length) return <p className="text-sm text-ink-muted">Nothing saved on this device yet. Use Save in the top bar.</p>;
  return (
    <ul className="flex flex-col gap-2" data-testid="saved-list">
      {list.map((e) => (
        <li key={e.id} className="flex flex-col gap-2 rounded-xl border border-line p-2" data-saved={e.name}>
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
                  refresh();
                }}
              >
                OK
              </Button>
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{e.name}</span>
              <span className="text-xs text-ink-muted">{new Date(e.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            <Button
              tone="primary"
              onClick={() => {
                const c = openSaved(e);
                if (c) onOpen(c, e.name);
                else onToast('This saved layout looks damaged');
              }}
            >
              Open
            </Button>
            <Button tone="quiet" onClick={() => setRenaming({ id: e.id, name: e.name })}>
              Rename
            </Button>
            <Button
              tone="quiet"
              onClick={() => {
                if (!duplicateSaved(e.id)) onToast("Can't save on this device");
                refresh();
              }}
            >
              Duplicate
            </Button>
            <Button
              tone="quiet"
              onClick={async () => {
                const c = openSaved(e);
                if (!c) return;
                const { shareLink } = await import('@/export/share');
                const r = await shareLink(shareLinks(c).edit, e.name);
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
                    refresh();
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
      ))}
    </ul>
  );
}
