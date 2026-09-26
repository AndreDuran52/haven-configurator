// ?view (plan §9): the client's read-only panel. The sofa's sizes, seats and
// look; no editing controls. "Edit a copy" in the top bar drops ?view.
import { fabricOf, finishOf } from '@/engine';
import { fmtFtIn, fmtIn } from '@/plan/format';
import { builtOf, useLive } from '@/state/store';
import { Section } from './controls';

export function ViewSummary() {
  const c = useLive();
  const b = builtOf(c);
  const hasTable = Object.values(c.runs).some((ps) => ps?.some((p) => p.kind === 'table'));
  const rows: [string, string][] = [
    ['Shape', b.shape === 'U' ? 'U' : b.shape === 'L-left' ? 'L, left' : 'L, right'],
    ['Width', `${fmtIn(b.W)} (${fmtFtIn(b.W)})`],
    ...(b.shape !== 'L-right' ? [['Left', fmtIn(b.L)] as [string, string]] : []),
    ...(b.shape !== 'L-left' ? [['Right', fmtIn(b.R)] as [string, string]] : []),
    ['Depth', fmtIn(b.D)],
    ['Seat depth', fmtIn(b.seatDepth)],
    ['Seats', b.seats.label.replace(/^Seats /, '')],
    ['Fabric', fabricOf(c.fabric).name],
    ...(hasTable ? [['Tables', `${c.tableStyle === 'standard' ? 'Wood top on fabric' : 'All wood'}, ${finishOf(c.tableFinish).name.toLowerCase()}`] as [string, string]] : []),
  ];
  return (
    <div className="flex flex-col gap-5" data-testid="view-summary">
      <Section title="This sofa">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <p className="text-xs text-ink-muted">A view-only layout. Switch between Plan and 3D above; tap "Edit a copy" to change it.</p>
    </div>
  );
}
