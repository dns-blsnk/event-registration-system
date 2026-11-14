import { describe, expect, it } from 'vitest';

import { normalizeLabel } from './text.js';

describe('normalizeLabel', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeLabel('  Machine \n\t learning ')).toBe('Machine learning');
  });
});
