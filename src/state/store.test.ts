import { describe, expect, it } from 'vitest';
import { encode, setMeasurements, standardL, standardU } from '@/engine';
import { createHavenStore, isDirty } from './store';

describe('Projects home (H6b): open, goHome, unsaved changes', () => {
  it('open() starts a fresh undo history in the editor; goHome() keeps the layout', () => {
    const s = createHavenStore(standardU(), { screen: 'home' });
    s.getState().commit(setMeasurements(standardU(), { W: 200 }).config);
    const L = standardL('left');
    s.getState().open(L, { lastStart: { kind: 'standardL', side: 'left' } });
    const st = s.getState();
    expect([st.ui.screen, st.config, st.past.length, st.future.length, st.ui.project]).toEqual(['editor', L, 0, 0, null]);
    expect(st.ui.lastStart).toEqual({ kind: 'standardL', side: 'left' });
    st.goHome();
    expect([s.getState().ui.screen, s.getState().config]).toEqual(['home', L]);
  });

  it('dirty: an open project differs from its saved code; with no project, any undoable edit', () => {
    const c = standardU();
    const s = createHavenStore(c);
    expect(isDirty(s.getState())).toBe(false);
    s.getState().open(c, { project: { id: 'p', name: 'Mitchell', code: encode(c) } });
    expect(isDirty(s.getState())).toBe(false);
    s.getState().commit(setMeasurements(c, { W: 200 }).config);
    expect(isDirty(s.getState())).toBe(true);
    s.getState().undo();
    expect(isDirty(s.getState())).toBe(false);
    s.getState().open(c);
    expect(isDirty(s.getState())).toBe(false);
    s.getState().commit(setMeasurements(c, { W: 200 }).config);
    expect(isDirty(s.getState())).toBe(true);
  });
});
