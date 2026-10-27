// ?view (plan §9): the client's read-only panel. The sofa's sizes, seats and
// look; no editing controls. "Edit a copy" in the top bar drops ?view.
import { fabricOf, finishOf, teeOf } from '@/engine';
import { fmtFtIn, fmtIn } from '@/plan/format';
import { builtOf, layoutBuiltOf, useLive, useLiveLayout } from '@/state/store';
import { Section } from './controls';

export function ViewSummary() {
  const c = useLive();
  const b = builtOf(c);
  const layout = useLiveLayout();
  const lb = layoutBuiltOf(layout);
  const t = teeOf(layout);
  const hasTable = layout.sections.some((s) => Object.values(s.config.runs).some((ps) => ps?.some((p) => p.kind === 'table')));
  const shape: [string, string][] = t
    ? [
        ['Shape', `T, ${t.sharedBack ? 'shared back' : 'two backs'}`],
        ['Width', `${fmtIn(t.total)} (${fmtFtIn(t.total)})`],
        ['Stem', t.stem[0] === t.stem[1] ? fmtIn(t.stem[0]) : `${fmtIn(t.stem[0])} and ${fmtIn(t.stem[1])}`],
        ['Stem width', fmtIn(t.stemWidth)],
      ]
    : [
        ['Shape', b.shape === 'U' ? 'U' : b.shape === 'L-left' ? 'L, left' : 'L, right'],
        ['Width', `${fmtIn(b.W)} (${fmtFtIn(b.W)})`],
        ...(b.shape !== 'L-right' ? [['Left', fmtIn(b.L)] as [string, string]] : []),
        ...(b.shape !== 'L-left' ? [['Right', fmtIn(b.R)] as [string, string]] : []),
      ];
  const rows: [string, string][] = [
    ...shape,
    ['Depth', fmtIn(b.D)],
    ['Seat depth', fmtIn(b.seatDepth)],
    ['Seats', lb.seats.label.replace(/^Seats /, '')],
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
