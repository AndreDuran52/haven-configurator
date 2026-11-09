// A switch row for the menus (UX Phase 3): the tan track when on (tan for
// selected states, Andre 2026-11-08).
export function Toggle({ on, label, onChange, testId }: { on: boolean; label: string; onChange: (on: boolean) => void; testId?: string }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-11 items-center justify-between gap-4 rounded-lg px-3 text-[15px] font-medium text-ink hover-hover:bg-panel-2" data-testid={testId}>
      {label}
      <span className={`relative h-6 w-10 shrink-0 rounded-full ${on ? 'bg-accent' : 'bg-line'}`} aria-hidden>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${on ? 'left-4.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
