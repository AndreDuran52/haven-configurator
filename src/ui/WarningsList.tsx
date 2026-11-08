// Amber warnings (plan §5.4): never blocking, always visible. A T names the half.
import { sectionLabel, type WarningCode } from '@/engine';
import { layoutBuiltOf, useLiveLayout } from '@/state/store';
import { WarnChip } from './controls';

/** Nothing to show: no list at all (UX Phase 3: no empty "No warnings"). */
export function WarningsList({ only, exclude }: { only?: WarningCode[]; exclude?: WarningCode[] }) {
  const layout = useLiveLayout();
  const warnings = layoutBuiltOf(layout).warnings.filter((w) => (!only || only.includes(w.code)) && !exclude?.includes(w.code));
  if (!warnings.length) return null;
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
