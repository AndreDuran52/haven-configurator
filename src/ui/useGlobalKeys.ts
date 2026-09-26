// Global keys (plan §8): Cmd/Ctrl+Z undo, Shift+Cmd+Z / Ctrl+Y redo, Delete
// removes the selected piece, Escape cancels a gesture / tap-to-place / the
// selection. Typing in a field keeps its own keys.
import { useEffect } from 'react';
import { deleteLoose, deletePiece } from '@/engine';
import { cancelPlanGesture } from '@/plan/planScreen';
import type { HavenStore } from '@/state/store';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function useGlobalKeys(store: HavenStore) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = store.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (cancelPlanGesture()) return;
        if (s.ui.placing) return s.setUi({ placing: null });
        if (s.ui.selectedId && !typing(e.target)) return s.setUi({ selectedId: null });
        return;
      }
      if (typing(e.target) || s.ui.readOnly) return;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.ui.selectedId && s.ui.view === 'plan') {
        e.preventDefault();
        const id = s.ui.selectedId;
        const r = s.config.loose.some((l) => l.id === id) ? deleteLoose(s.config, id) : deletePiece(s.config, id);
        if (r.rejected) return s.toast(r.rejected.message);
        s.commit(r.config);
        s.setUi({ selectedId: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}
