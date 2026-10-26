// The store over layouts (shapes milestone, Stage A): the edited section's
// config is derived; a commit on one half lifts into the layout with the other
// half's shared fields in step; one commit is one undo step for both halves.
import { describe, expect, it } from 'vitest';
import { setMeasurements, solo, standardU, teeLayout } from '@/engine';
import { createHavenStore, isDirty } from './store';

describe('store over layouts', () => {
  it('a one-sofa layout behaves exactly as before', () => {
    const c = standardU();
    const s = createHavenStore(c);
    expect(s.getState().config).toBe(c);
    expect(s.getState().layout.sections[0]!.config).toBe(c);
    expect(s.getState().commit(setMeasurements(c, { W: 200 }).config)).toBeNull();
    expect(s.getState().config.W).toBe(200);
    expect(s.getState().past).toHaveLength(1);
    s.getState().undo();
    expect(s.getState().config).toBe(c);
  });

  it('editing the right half of a T: derived config, the depth follows in both halves, one undo step', () => {
    const t = teeLayout({ total: 229, stem: 110 });
    const s = createHavenStore(t);
    s.getState().setSection('b');
    expect(s.getState().config).toBe(t.sections[1]!.config);
    s.getState().commit(setMeasurements(s.getState().config, { D: 40 }).config);
    const l = s.getState().layout;
    expect(l.sections.map((x) => x.config.D)).toEqual([40, 40]);
    expect(s.getState().past).toHaveLength(1);
    s.getState().undo();
    expect(s.getState().layout).toBe(t);
    // A width change on the right half leaves the left half's object untouched.
    s.getState().commit(setMeasurements(s.getState().config, { W: 125 }).config);
    expect(s.getState().layout.sections[0]).toBe(t.sections[0]);
    // A draft previews the whole layout; cancel leaves no trace.
    s.getState().setDraft(setMeasurements(s.getState().config, { W: 130 }).config);
    expect(s.getState().draftLayout?.sections[1]!.config.W).toBe(130);
    expect(s.getState().draft?.W).toBe(130);
    s.getState().cancelDraft();
    expect(s.getState().draft).toBeNull();
    // An unknown section falls back to the root.
    s.getState().setSection('zz');
    expect(s.getState().ui.section).toBe('a');
  });

  it('dirty compares the layout code with the saved project code', () => {
    const c = standardU();
    const s = createHavenStore(solo(c));
    s.getState().open(solo(c), { project: { id: 'p', name: 'Mitchell', code: '1UW188L132R132D44_bt32s36_la72_ra72.wh' } });
    expect(isDirty(s.getState())).toBe(false);
  });
});
