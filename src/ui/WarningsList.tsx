// Amber warnings (plan §5.4): never blocking, always visible.
import { builtOf, useLive } from '@/state/store';
import { WarnChip } from './controls';

export function WarningsList() {
  const warnings = builtOf(useLive()).warnings;
  if (!warnings.length) return <p className="text-sm text-ink-muted">No warnings</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="warnings">
      {warnings.map((w, i) => (
        <li key={`${w.code}${i}`} data-code={w.code}>
          <WarnChip>{w.message}</WarnChip>
        </li>
      ))}
    </ul>
  );
}
