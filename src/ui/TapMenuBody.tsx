// The tap menu's content per selection (plan §8 "Tap menu"). Every action is
// one engine op and one commit; a refusal shows its message as a toast.
import {
  convertPiece,
  deleteLoose,
  deletePiece,
  endIndex,
  evenTableSeats,
  fillGap,
  openEnds,
  resizeLoose,
  resizePiece,
  SEAT_WARN,
  setArmWidth,
  setEndCap,
  setTableStyle,
  tableSeats,
  type EditResult,
  type EndCap,
  type RunEnd,
} from '@/engine';
import { fmtIn } from '@/plan/format';
import { builtOf, useHavenStore } from '@/state/store';
import { Button, Segmented } from './controls';
import { MeasureField } from './MeasureField';
import { TableWidth } from './TableWidth';
import type { Selection } from './selection';
import { WedgeSlider } from './WedgeSlider';

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function MenuBody({ sel }: { sel: Selection }) {
  const store = useHavenStore();
  const s = () => store.getState();
  const apply = (r: EditResult, then?: () => void) => {
    if (r.rejected) return s().toast(r.rejected.message);
    s().commit(r.config);
    then?.();
  };
  const clear = () => s().setUi({ selectedId: null });
  const config = s().config;
  const tryOp = (r: EditResult) => (r.rejected ? r.rejected.message : null);

  // Tap the corner to size it (Andre, 2026-11-06): the slider is right here.
  if (sel.type === 'wedge') return <WedgeSlider variant="menu" />;

  if (sel.type === 'loose') {
    const lp = config.loose.find((q) => q.id === sel.id);
    if (!lp) return null;
    const coffee = sel.kind === 'coffeeTable';
    const clearance = builtOf(config).clearances.find((q) => q.pieceId === sel.id);
    return (
      <div className="flex flex-col gap-2">
        <MeasureField
          name={`${sel.id}-w`}
          label={coffee ? 'Size' : 'W'}
          labelClass={coffee ? 'w-10' : 'w-6'}
          value={lp.w}
          read={(c) => c.loose.find((q) => q.id === sel.id)?.w ?? 0}
          apply={(c, v) => {
            const q = c.loose.find((x) => x.id === sel.id)!;
            return resizeLoose(c, sel.id, v, coffee ? v : q.d);
          }}
        />
        {!coffee && (
          <MeasureField
            name={`${sel.id}-d`}
            label="D"
            value={lp.d}
            read={(c) => c.loose.find((q) => q.id === sel.id)?.d ?? 0}
            apply={(c, v) => resizeLoose(c, sel.id, c.loose.find((x) => x.id === sel.id)!.w, v)}
          />
        )}
        {clearance?.min != null && (
          <p className="text-sm text-ink-muted">
            Closest clearance {fmtIn(clearance.min)}
            {clearance.min < 14 ? ' (under 14″)' : ''}. Drag it in the plan to move it.
          </p>
        )}
        <Button onClick={() => apply(deleteLoose(s().config, sel.id), clear)} className="text-danger">
          Delete
        </Button>
      </div>
    );
  }

  if (sel.type === 'gap') {
    const fills = [
      { kind: 'armless' as const, label: 'Armless seat' },
      { kind: 'oneArm' as const, label: 'One-arm seat' },
      { kind: 'table' as const, label: 'Table' },
    ];
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Fill with</p>
        <Row>
          {fills.map((f) => {
            const why = tryOp(fillGap(config, sel.id, f.kind));
            return (
              <Button key={f.kind} disabled={!!why} title={why ?? undefined} onClick={() => apply(fillGap(s().config, sel.id, f.kind), clear)}>
                {f.label}
              </Button>
            );
          })}
        </Row>
        <p className="text-sm text-ink-muted">Or drag its seams, or drop a piece from the tray into it.</p>
      </div>
    );
  }

  // Seats and tables: the run's open-end cap applies to the last two pieces at that end.
  const pieces = config.runs[sel.run]!;
  const piece = pieces[sel.index]!;
  // The open end nearest this piece (a straight sofa has one at each end).
  const dist = (e: RunEnd) => Math.abs(sel.index - endIndex(pieces, e));
  const open = openEnds(config.shape, sel.run).sort((a, b) => dist(a) - dist(b))[0] ?? null;
  const run = builtOf(config).runs.find((r) => r.id === sel.run)!;
  const nearEnd = open !== null && dist(open) <= 1;
  const capState = open ? run.endCaps[open] : null;
  const caps: { value: EndCap; label: string }[] = [
    { value: 'arm', label: 'Arm' },
    { value: 'table', label: 'Table' },
    { value: 'open', label: 'Open' },
  ];
  const endCap = nearEnd && capState && capState !== 'unfilled' && (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">End of this run</p>
      <Segmented
        label="End cap"
        value={(capState === 'armTable' ? 'table' : capState) as EndCap}
        options={caps}
        onChange={(v) => apply(setEndCap(s().config, sel.run, v, open ?? undefined))}
      />
      {capState === 'armTable' && <p className="text-sm text-ink-muted">A table outside the arm</p>}
    </div>
  );
  const del = (
    <Button onClick={() => apply(deletePiece(s().config, sel.id), clear)} className="text-danger">
      Delete
    </Button>
  );

  if (sel.type === 'table') {
    // Balance seats around a table (Andre, 2026-11-06): the seats either side, kept equal.
    const seats = tableSeats(config, sel.id);
    const uneven = !!seats && Math.abs(seats[0] - seats[1]) > 0.5;
    const narrow = !!seats && Math.min(...seats) < SEAT_WARN && piece.length <= 20 && config.dims.A > 10;
    return (
      <div className="flex flex-col gap-3">
        {seats && (
          <Row>
            <p data-testid="table-seats" className="mr-auto text-sm">
              Seats {fmtIn(seats[0])} | {fmtIn(seats[1])}
            </p>
            {uneven && <Button onClick={() => apply(evenTableSeats(s().config, sel.id))}>Even seats</Button>}
            {narrow && <Button onClick={() => apply(setArmWidth(s().config, 10))}>Try 10″ arms</Button>}
          </Row>
        )}
        {/* UX Phase 3c: the ± grows the table from its middle (the 20–40 chips are gone). */}
        <TableWidth id={sel.id} name={`menu-table-${sel.id}`} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Style (all tables)</p>
          <Segmented
            label="Table style"
            value={config.tableStyle}
            options={[
              { value: 'standard', label: 'Wood top' },
              { value: 'allWood', label: 'All wood' },
            ]}
            onChange={(v) => apply(setTableStyle(s().config, v))}
          />
        </div>
        {endCap}
        <p className="text-sm text-ink-muted">Drag the table to move it; drop it on the tray to remove it.</p>
        {del}
      </div>
    );
  }

  const convertWhy = tryOp(convertPiece(config, sel.id));
  return (
    <div className="flex flex-col gap-3">
      {/* A one-arm seat is sized by its seat; the title shows the piece and its arm (Andre, 2026-09-28). */}
      <MeasureField
        name={`${sel.id}-len`}
        label={piece.kind === 'oneArm' ? 'Seat' : 'Length'}
        labelClass="w-14"
        value={piece.kind === 'oneArm' ? piece.length - config.dims.A : piece.length}
        read={(c) => {
          const q = c.runs[sel.run]?.find((x) => x.id === sel.id);
          return q ? (q.kind === 'oneArm' ? q.length - c.dims.A : q.length) : 0;
        }}
        apply={(c, v) => resizePiece(c, sel.id, piece.kind === 'oneArm' ? v + c.dims.A : v)}
      />

      <Button disabled={!!convertWhy} title={convertWhy ?? undefined} onClick={() => apply(convertPiece(s().config, sel.id))}>
        {piece.kind === 'oneArm' ? 'Make armless' : 'Add an arm'}
      </Button>
      {endCap}
      {del}
    </div>
  );
}
