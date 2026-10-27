// The T's own controls (Shapes B1): which half is being edited, the whole T's
// total width and stem, the back down the stem, and the edited half's own width
// and stem. Every other sidebar control works on the edited half (shared
// fields such as depth reach both). Lazy: only a layout with joined sections shows it.
import { sectionLabel, setMeasurements, setTeeSharedBack, setTeeStem, setTeeWidth, teeOf } from '@/engine';
import { fmtIn } from '@/plan/format';
import { useHaven, useHavenStore, useLiveLayout } from '@/state/store';
import { Section, Segmented } from './controls';
import { MeasureField } from './MeasureField';

const inch = (n: number) => `${fmtIn(n, { mark: false })}″`;

export default function SectionsPanel() {
  const store = useHavenStore();
  const layout = useLiveLayout();
  const section = useHaven((s) => s.ui.section);
  const t = teeOf(layout);
  if (!t) return null;
  const left = section === layout.sections[0]!.id;
  const half = left ? t.left : t.right;
  const stemKey = left ? 'R' : 'L';
  const even = t.stem[0] === t.stem[1];

  return (
    <>
      <Section title="T shape">
        <Segmented
          label="Editing"
          value={section}
          options={layout.sections.map((s) => ({ value: s.id, label: sectionLabel(layout, s.id) }))}
          onChange={(id) => store.getState().setSection(id)}
        />
        <MeasureField
          name="total"
          label="Total width"
          labelClass="w-20"
          value={t.total}
          apply={(c) => ({ config: c, rejected: null })}
          layoutOp={setTeeWidth}
          readLayout={(l) => teeOf(l)?.total ?? 0}
        />
        <MeasureField
          name="stem"
          label="Stem"
          labelClass="w-20"
          value={Math.max(...t.stem)}
          apply={(c) => ({ config: c, rejected: null })}
          layoutOp={setTeeStem}
          readLayout={(l) => Math.max(...(teeOf(l)?.stem ?? [0]))}
          hint={even ? undefined : `Sides ${inch(t.stem[0])} and ${inch(t.stem[1])}`}
        />
        <Segmented
          label="Back down the stem"
          value={t.sharedBack ? 'shared' : 'two'}
          options={[
            { value: 'shared', label: 'Shared back' },
            { value: 'two', label: 'Two backs' },
          ]}
          onChange={(v) => {
            const s = store.getState();
            const r = setTeeSharedBack(s.layout, v === 'shared');
            if (r.rejected) s.toast(r.rejected.message);
            else s.commitLayout(r.layout, { key: 'teeBack' });
          }}
        />
        <p className="text-sm text-ink-muted" data-testid="tee-info">
          Halves {inch(t.left.W)} and {inch(t.right.W)}. Stem {inch(t.stemWidth)} wide.
        </p>
      </Section>
      <Section title={sectionLabel(layout, section)}>
        <MeasureField name="W" label="Width" labelClass="w-14" value={half.W} apply={(c, v) => setMeasurements(c, { W: v })} />
        <MeasureField
          name={stemKey}
          label="Stem"
          labelClass="w-14"
          value={half[stemKey]}
          apply={(c, v) => setMeasurements(c, { [stemKey]: v })}
        />
      </Section>
    </>
  );
}
