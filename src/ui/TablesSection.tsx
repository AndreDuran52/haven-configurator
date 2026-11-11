// The Pieces tab's Tables section (UX Phase 3c, Andre 2026-11-09: "anything
// about a table's size" lives on Pieces): one row per table, named by where it
// sits, with its width ± (grows from the middle) and the seats either side.
import { runIds, tableSeats, type Config, type RunId } from '@/engine';
import { fmtIn } from '@/plan/format';
import { useLive } from '@/state/store';
import { Section } from './controls';
import { TableWidth } from './TableWidth';

const WHERE: Record<RunId, string> = { back: 'Back table', left: 'Left side table', right: 'Right side table' };

/** Every table, named by its run ("Back table", or "Back table 1" and "2" when a run has two). */
function tablesOf(c: Config): { id: string; name: string }[] {
  return runIds(c.shape).flatMap((run) => {
    const ts = (c.runs[run] ?? []).filter((p) => p.kind === 'table');
    const base = c.shape === 'straight' ? 'Table' : WHERE[run];
    return ts.map((p, i) => ({ id: p.id, name: ts.length > 1 ? `${base} ${i + 1}` : base }));
  });
}

export function TablesSection() {
  const live = useLive();
  const tables = tablesOf(live);
  if (!tables.length) return null;
  return (
    <Section title="Tables">
      {tables.map((t) => {
        const seats = tableSeats(live, t.id);
        return (
          <div key={t.id} className="flex flex-col gap-1" data-testid="table-row" data-table={t.id}>
            <p className="text-[15px] font-semibold">{t.name}</p>
            <TableWidth id={t.id} name={`table-${t.id}`} />
            {seats && (
              <p className="text-[15px]" data-testid="table-row-seats">
                Seats {fmtIn(seats[0])} | {fmtIn(seats[1])}
              </p>
            )}
          </div>
        );
      })}
    </Section>
  );
}
