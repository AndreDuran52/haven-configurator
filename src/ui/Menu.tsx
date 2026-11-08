// A small drop-down menu for the top bar (UX Phase 3): a button that opens a
// panel under it; Escape or a click outside closes it. Plain React (no Radix),
// so it stays tiny in the entry chunk; the panel's content is passed in.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Menu({
  label,
  button,
  children,
  align = 'left',
  testId,
}: {
  /** The accessible name of the button. */
  label: string;
  button: ReactNode;
  /** The panel; `close` closes it (after an item runs). */
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative min-w-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-1.5 rounded-lg px-2.5 text-[15px] font-semibold text-ink hover-hover:bg-panel-2 active:bg-panel-2"
        data-testid={testId}
      >
        {button}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-40 mt-1 flex min-w-56 flex-col rounded-xl border border-line bg-panel p-1.5 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
          data-testid={testId ? `${testId}-menu` : undefined}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onSelect, danger = false, testId }: { children: ReactNode; onSelect: () => void; danger?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex min-h-11 items-center rounded-lg px-3 text-left text-[15px] font-medium hover-hover:bg-panel-2 active:bg-panel-2 ${danger ? 'text-danger' : 'text-ink'}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
