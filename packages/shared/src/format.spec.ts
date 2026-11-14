import { describe, expect, it } from 'vitest';

import { formatPercent } from './format.js';

describe('formatPercent', () => {
  it.each([
    [0, '0%'],
    [0.874, '87%'],
    [0.9, '90%'],
    [1, '100%'],
  ])('shows %p as %s', (share, text) => {
    expect(formatPercent(share)).toBe(text);
  });
});
