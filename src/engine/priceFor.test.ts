import { describe, expect, it } from 'vitest';
import { priceFor } from './priceFor';
import { U } from './testing';

describe('priceFor (§9)', () => {
  it('is a pure stub returning null, and nothing in ui/ or plan/ imports it', () => {
    expect(priceFor(U())).toBeNull();
    const sources = import.meta.glob<string>(['/src/ui/**/*.{ts,tsx}', '/src/plan/**/*.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    for (const [file, text] of Object.entries(sources)) expect(text, file).not.toMatch(/priceFor/);
  });
});
