// The result line (UX Phase 3, Andre 2026-11-08): what the last edit changed,
// under the plan, in words the client can read over a shared screen. It stays
// until the next edit, Undo, or ×; Undo is inside it. Hidden during a drag
// (the plan's own readout and the trash bar are there).
import { useHaven, useHavenStore } from '@/state/store';

export function ResultLine() {
  const store = useHavenStore();
  const text = useHaven((s) => s.ui.result);
  const dragging = useHaven((s) => s.ui.dragging !== null);
  const canUndo = useHaven((s) => s.past.length > 0 && !s.draft);
  if (!text || dragging) return null;
  return (
    <div
      role="status"
      data-testid="result-line"
      className="absolute inset-x-3 bottom-2 z-20 mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5 shadow-md"
    >
      <p className="min-w-0 flex-1 text-[15px] font-semibold text-ink tabular-nums" data-testid="result-text">
        {text}
      </p>
      {canUndo && (
        <button type="button" className="min-h-11 shrink-0 rounded-lg px-3 text-[15px] font-semibold text-accent hover-hover:bg-panel-2" onClick={() => store.getState().undo()} aria-label="Undo the last change" data-testid="result-undo">
          Undo
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        className="min-h-11 min-w-11 shrink-0 rounded-lg text-xl leading-none text-ink hover-hover:bg-panel-2"
        onClick={() => store.getState().setUi({ result: null })}
        data-testid="result-dismiss"
      >
        ×
      </button>
    </div>
  );
}
