import { describe, expect, it } from 'vitest';

import { isValidRange, isWithin, overlaps } from './schedule.js';

function range(start: string, end: string): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: new Date(`2026-12-01T${start}:00Z`),
    endsAt: new Date(`2026-12-01T${end}:00Z`),
  };
}

describe('overlaps', () => {
  it.each([
    [range('09:00', '10:00'), range('09:30', '10:30'), true],
    [range('09:00', '12:00'), range('10:00', '11:00'), true],
    [range('10:00', '11:00'), range('09:00', '12:00'), true],
    [range('09:00', '10:00'), range('10:00', '11:00'), false],
    [range('09:00', '10:00'), range('11:00', '12:00'), false],
  ])('%j and %j overlap: %s', (a, b, expected) => {
    expect(overlaps(a, b)).toBe(expected);
    expect(overlaps(b, a)).toBe(expected);
  });
});

describe('zero-length ranges', () => {
  it('count as overlapping when they fall inside another range', () => {
    expect(overlaps(range('09:30', '09:30'), range('09:00', '10:00'))).toBe(true);
  });

  it('do not overlap a range that ends exactly at that instant', () => {
    expect(overlaps(range('10:00', '10:00'), range('09:00', '10:00'))).toBe(false);
  });
});

describe('isValidRange', () => {
  it('requires the end after the start', () => {
    expect(isValidRange(range('09:00', '10:00'))).toBe(true);
    expect(isValidRange(range('10:00', '10:00'))).toBe(false);
    expect(isValidRange(range('11:00', '10:00'))).toBe(false);
  });
});

describe('isWithin', () => {
  const event = range('09:00', '18:00');

  it('accepts a session inside the event, including its edges', () => {
    expect(isWithin(range('09:00', '18:00'), event)).toBe(true);
    expect(isWithin(range('10:00', '11:00'), event)).toBe(true);
  });

  it.each([range('08:00', '10:00'), range('17:00', '19:00'), range('07:00', '08:00')])(
    'rejects a session outside the event %j',
    (session) => {
      expect(isWithin(session, event)).toBe(false);
    },
  );
});
