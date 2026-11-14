import { describe, expect, it } from 'vitest';

import { formatDateTime } from './format';

describe('formatDateTime', () => {
  it('shows day, month, year and time', () => {
    expect(formatDateTime('2026-11-14T09:05:00')).toBe('14 Nov 2026, 09:05');
  });
});
