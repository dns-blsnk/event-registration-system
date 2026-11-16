import { describe, expect, it } from 'vitest';

import { normalizeLabel, trimString } from './transforms.js';

describe('trimString', () => {
  it('trims strings and leaves other values alone', () => {
    expect(trimString({ value: '  a b  ' })).toBe('a b');
    expect(trimString({ value: 42 })).toBe(42);
  });
});

describe('normalizeLabel', () => {
  it('trims and collapses inner whitespace into single spaces', () => {
    expect(normalizeLabel({ value: '  Jazz \n\t  Night ' })).toBe('Jazz Night');
  });

  it('leaves non-strings alone', () => {
    expect(normalizeLabel({ value: null })).toBeNull();
  });
});
