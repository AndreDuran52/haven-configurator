// Amber warnings (plan §5.4): never blocking, always visible. A T names the half.
import { sectionLabel } from '@/engine';
import { layoutBuiltOf, useLiveLayout } from '@/state/store';
import { WarnChip } from './controls';

export function WarningsList() {
  const layout = useLiveLayout();
  const warnings = layoutBuiltOf(layout).warnings;
  if (!warnings.length) return <p className="text-sm text-ink-muted">No warnings</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="warnings">
      {warnings.map((w, i) => (
        <li key={`${w.code}${i}`} data-code={w.code} data-section={w.section ?? undefined}>
          <WarnChip>{w.section ? `${sectionLabel(layout, w.section)}: ${w.message}` : w.message}</WarnChip>
        </li>
      ))}
    </ul>
  );
}
