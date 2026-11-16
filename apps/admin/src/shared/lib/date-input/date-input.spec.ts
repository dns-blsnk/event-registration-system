import { describe, expect, it } from 'vitest';

import { fromInputDateTime, toInputDateTime } from './date-input';

describe('datetime-local conversion', () => {
  it('round-trips a date through the datetime-local input', () => {
    const iso = '2026-12-01T09:30:00.000Z';

    expect(fromInputDateTime(toInputDateTime(iso))).toBe(iso);
  });
});
