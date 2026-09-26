// A Radix dialog shell sized for the iPad (full-width sheet on phones).
import * as D from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <D.Content className="safe-area-dialog fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl bg-panel p-5 text-ink shadow-xl">
          <D.Title className="text-lg font-semibold">{title}</D.Title>
          {description ? (
            <D.Description className="text-sm text-ink-muted">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
