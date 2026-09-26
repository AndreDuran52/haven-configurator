// Tap menu (plan §8): tap a piece (under 6 px, under 500 ms). A Radix Popover
// anchored to the piece's box; a bottom sheet on phones. Seat: title, length,
// convert, end cap (at open ends), delete. Table: width chips 24–40, style,
// delete. Gap: Fill with… Loose: size, delete. Wedge: its size and the slider.
// Lazy-loaded (default export) so Radix Popover stays out of the entry chunk.
import * as Popover from '@radix-ui/react-popover';
import { useEffect, useState, type ReactNode } from 'react';
import { planToClient } from '@/plan/planScreen';
import { builtOf, useHaven, useHavenStore, useLive } from '@/state/store';
import { selectionOf } from './selection';
import { MenuBody } from './TapMenuBody';

const PHONE_MAX = 600;

function useWide() {
  const [wide, setWide] = useState(() => window.innerWidth > PHONE_MAX);
  useEffect(() => {
    const on = () => setWide(window.innerWidth > PHONE_MAX);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return wide;
}

export default function TapMenu() {
  const store = useHavenStore();
  const selectedId = useHaven((s) => s.ui.selectedId);
  const view = useHaven((s) => s.ui.view);
  const live = useLive();
  const sel = selectionOf(live, selectedId);
  const wide = useWide();
  const close = () => store.getState().setUi({ selectedId: null });
  if (!sel || view !== 'plan') return null;

  const body: ReactNode = <MenuBody key={sel.id} sel={sel} />;
  if (!wide) {
    return (
      <div
        role="dialog"
        aria-label={sel.title}
        data-tap-menu=""
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-panel px-4 pt-3 shadow-2xl"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{sel.title}</h2>
          <button type="button" className="stepper" aria-label="Close" onClick={close}>
            ×
          </button>
        </div>
        {body}
      </div>
    );
  }

  // Anchor: the piece's box on screen.
  const b = builtOf(live);
  const box = sel.rect ?? b.pieces.find((p) => p.id === selectedId)?.bbox;
  const p0 = box && planToClient(box.x, box.y);
  const p1 = box && planToClient(box.x + box.w, box.y + box.h);
  if (!p0 || !p1) return null;
  return (
    <Popover.Root open onOpenChange={(o) => !o && close()}>
      <Popover.Anchor asChild>
        <div
          aria-hidden
          className="pointer-events-none fixed"
          style={{ left: Math.min(p0[0], p1[0]), top: Math.min(p0[1], p1[1]), width: Math.abs(p1[0] - p0[0]), height: Math.abs(p1[1] - p0[1]) }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          data-tap-menu=""
          aria-label={sel.title}
          side="bottom"
          align="center"
          sideOffset={40} // clears the seam grips outside the seat front
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Taps in the plan are handled there (select another piece, drag a grip).
            if ((e.target as Element | null)?.closest?.('[data-plan-svg]')) e.preventDefault();
          }}
          className="z-30 w-80 max-w-[calc(100vw-24px)] rounded-xl border border-line bg-panel p-3 text-ink shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{sel.title}</h2>
            <Popover.Close className="stepper" aria-label="Close">
              ×
            </Popover.Close>
          </div>
          {body}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
