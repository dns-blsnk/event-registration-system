import { describe, expect, it } from 'vitest';

import { EVENT_STATUSES, EVENT_TRANSITIONS, eventTimingProblem } from './domain.js';

describe('EVENT_TRANSITIONS', () => {
  it('covers every status', () => {
    expect(Object.keys(EVENT_TRANSITIONS).sort()).toEqual([...EVENT_STATUSES].sort());
  });

  it('keeps completed and cancelled events final', () => {
    expect(EVENT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(EVENT_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('eventTimingProblem', () => {
  const timing = {
    startsAt: new Date('2026-12-01T09:00:00Z'),
    endsAt: new Date('2026-12-02T18:00:00Z'),
  };

  it.each([
    ['PUBLISHED', '2026-11-30T12:00:00Z', undefined],
    ['PUBLISHED', '2026-12-01T09:00:00Z', 'An event that has already started cannot be published'],
    ['COMPLETED', '2026-11-30T12:00:00Z', 'An event cannot be completed before it starts'],
    ['COMPLETED', '2026-12-01T10:00:00Z', undefined],
    ['CANCELLED', '2026-12-01T10:00:00Z', undefined],
    ['CANCELLED', '2026-12-02T18:00:00Z', 'An event that has already ended cannot be cancelled'],
    ['DRAFT', '2026-12-05T00:00:00Z', undefined],
  ] as const)('moving to %s at %s', (to, now, problem) => {
    expect(eventTimingProblem(to, { ...timing, now: new Date(now) })).toBe(problem);
  });
});
