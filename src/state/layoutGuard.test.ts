// Shapes milestone (2026-10-26): every save, link and draft goes through the
// layout codec, so no path can silently drop a section of a T. App code may
// not call the one-sofa encode()/decode() (tests and the engine may).
import { describe, expect, it } from 'vitest';

describe('no one-sofa codec outside the engine', () => {
  it('app files use encodeLayout / decodeLayout (or codeOf), never encode() / decode()', () => {
    const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/engine/**', '!/src/**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    for (const [file, text] of Object.entries(sources)) {
      expect(text, file).not.toMatch(/\b(?<!\.)(encode|decode)\(/);
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(encode|decode)\b[^}]*\}\s*from\s*'@\/engine'/);
    }
  });
});
