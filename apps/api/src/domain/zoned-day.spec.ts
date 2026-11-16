import { describe, expect, it } from 'vitest';

import { endOfZonedDay, startOfZonedDay } from './zoned-day.js';

describe('zoned days', () => {
  it('starts a day at local midnight', () => {
    expect(startOfZonedDay('2026-11-16', 'Europe/Tallinn').toISOString()).toBe(
      '2026-11-15T22:00:00.000Z',
    );
    expect(startOfZonedDay('2026-11-16', 'America/New_York').toISOString()).toBe(
      '2026-11-16T05:00:00.000Z',
    );
  });

  it('ends a day just before the next local midnight', () => {
    expect(endOfZonedDay('2026-11-16', 'Europe/Tallinn').toISOString()).toBe(
      '2026-11-16T21:59:59.999Z',
    );
  });

  it('follows daylight saving: the day the clocks go forward is 23 hours long', () => {
    const start = startOfZonedDay('2026-03-29', 'Europe/Tallinn');
    const end = endOfZonedDay('2026-03-29', 'Europe/Tallinn');

    expect(start.toISOString()).toBe('2026-03-28T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-29T20:59:59.999Z');
  });

  it('starts a day where daylight saving skips midnight at the first moment it exists', () => {
    // Santiago moves its clocks from 00:00 to 01:00 on 6 September 2026.
    expect(startOfZonedDay('2026-09-06', 'America/Santiago').toISOString()).toBe(
      '2026-09-06T04:00:00.000Z',
    );
    expect(endOfZonedDay('2026-09-05', 'America/Santiago').toISOString()).toBe(
      '2026-09-06T03:59:59.999Z',
    );
  });

  it('keeps UTC days as they are', () => {
    expect(startOfZonedDay('2026-11-16', 'UTC').toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });

  it.each(['16.11.2026', '2026-02-30', '2026-13-01'])(
    'refuses %s, which is not a calendar day',
    (day) => {
      expect(() => startOfZonedDay(day, 'UTC')).toThrow(RangeError);
    },
  );
});
