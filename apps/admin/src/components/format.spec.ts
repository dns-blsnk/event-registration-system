import { describe, expect, it } from 'vitest';

import { formatDateTime, formatPercent } from './format';

describe('formatDateTime', () => {
  it('shows day, month, year and time', () => {
    expect(formatDateTime('2026-11-14T09:05:00')).toBe('14 Nov 2026, 09:05');
  });
});

describe('formatPercent', () => {
  it.each([
    [0, '0%'],
    [0.874, '87%'],
    [1, '100%'],
  ])('shows %p as %s', (share, text) => {
    expect(formatPercent(share)).toBe(text);
  });
});
