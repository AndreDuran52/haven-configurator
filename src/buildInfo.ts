// Build metadata injected by vite.config.ts (`define`). Falls back to "dev"
// where the define is absent (vitest).
export const buildInfo = {
  commit: typeof __COMMIT__ === 'string' ? __COMMIT__ : 'dev',
} as const
