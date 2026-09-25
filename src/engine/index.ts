// Public API of the pure geometry engine (plan §5). No React, three, zustand,
// @/ or ../ imports anywhere in src/engine (oxlint-enforced).
export * from './types';
export * from './pieces';
export * from './defaults';
export * from './layout';
export * from './absorb';
export * from './placement';
export * from './normalize';
export * from './rules';
export * from './edit';
export * from './limits';
export * from './buildHaven';
export * from './seating';
export * from './clearance';
export * from './profiles';
export * from './world';
export * from './ops';
export * from './shape';
export * from './pieceOps';
export * from './tableOps';
export * from './looseOps';
export * from './codec';
