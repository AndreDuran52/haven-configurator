// The tap menu's content per selection (plan §8 "Tap menu"). Every action is
// one engine op and one commit; a refusal shows its message as a toast.
import {
  convertPiece,
  deleteLoose,
  deletePiece,
  endIndex,
  fillGap,
  openEnd,
  resetWedge,
  resizeLoose,
  resizePiece,
  setEndCap,
  setTableStyle,
  type EditResult,
  type EndCap,
} from '@/engine';
import { fmtIn } from '@/plan/format';
import { builtOf, useHavenStore } from '@/state/store';
import { Button, Segmented } from './controls';
import { MeasureField } from './MeasureField';
import type { Selection } from './selection';

const TABLE_WIDTHS = [24, 28, 32, 36, 40];


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

  if (sel.type === 'wedge') {
    const manual = config.wedgeC !== null;
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-ink-muted">Size the corner with the wedge slider under the plan.</p>
        <Button disabled={!manual} onClick={() => apply(resetWedge(s().config))}>
          Reset wedge
        </Button>
      </div>
    );
  }

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
          <p className="text-xs text-ink-muted">
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
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Fill with</p>
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
        <p className="text-xs text-ink-muted">Or drag its seams, or drop a piece from the tray into it.</p>
      </div>
    );
  }

  // Seats and tables: the run's open-end cap applies to the last two pieces at that end.
  const pieces = config.runs[sel.run]!;
  const piece = pieces[sel.index]!;
  const open = openEnd(config.shape, sel.run);
  const run = builtOf(config).runs.find((r) => r.id === sel.run)!;
  const nearEnd = open !== null && Math.abs(sel.index - endIndex(pieces, open)) <= 1;
  const capState = run.endCap;
  const caps: { value: EndCap; label: string }[] = [
    { value: 'arm', label: 'Arm' },
    { value: 'table', label: 'Table' },
    { value: 'open', label: 'Open' },
  ];
  const endCap = nearEnd && capState && capState !== 'unfilled' && (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">End of this run</p>
      <Segmented
        label="End cap"
        value={(capState === 'armTable' ? 'table' : capState) as EndCap}
        options={caps}
        onChange={(v) => apply(setEndCap(s().config, sel.run, v))}
      />
      {capState === 'armTable' && <p className="text-xs text-ink-muted">A table outside the arm</p>}
    </div>
  );
  const del = (
    <Button onClick={() => apply(deletePiece(s().config, sel.id), clear)} className="text-danger">
      Delete
    </Button>
  );

  if (sel.type === 'table') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Width</p>
          <Row>
            {TABLE_WIDTHS.map((w) => (
              <Button
                key={w}
                tone={piece.length === w ? 'primary' : 'plain'}
                aria-pressed={piece.length === w}
                onClick={() => apply(resizePiece(s().config, sel.id, w))}
              >
                {w}″
              </Button>
            ))}
          </Row>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Style (all tables)</p>
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
        <p className="text-xs text-ink-muted">Drag the table to move it; drop it on the tray to remove it.</p>
        {del}
      </div>
    );
  }

  const convertWhy = tryOp(convertPiece(config, sel.id));
  return (
    <div className="flex flex-col gap-3">
      <MeasureField
        name={`${sel.id}-len`}
        label="Length"
        labelClass="w-14"
        value={piece.length}
        read={(c) => c.runs[sel.run]?.find((q) => q.id === sel.id)?.length ?? 0}
        apply={(c, v) => resizePiece(c, sel.id, v)}
      />
      <Button disabled={!!convertWhy} title={convertWhy ?? undefined} onClick={() => apply(convertPiece(s().config, sel.id))}>
        {piece.kind === 'oneArm' ? 'Make armless' : 'Add an arm'}
      </Button>
      {endCap}
      {del}
    </div>
  );
}
