// The camera state the HTML overlay (height ticks, seat markers) draws from,
// published by the Rig on every controls update. Kept outside React state so a
// camera move never re-renders the canvas tree.
export interface ViewState {
  zoom: number;
  /** screen y (CSS px) of a height above the floor, in the current view */
  heightY: (h: number) => number;
  /** screen x of the sofa's left end in the current view */
  leftX: number;
  /** a world point to screen (CSS px) in the current view (the seat markers in Top) */
  project: (p: [number, number, number]) => [number, number];
  resting: boolean;
}

export function createViewStore() {
  let state: ViewState | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (s: ViewState) => {
      state = s;
      for (const l of listeners) l();
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

export type ViewStore = ReturnType<typeof createViewStore>;
