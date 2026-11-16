import { afterEach, describe, expect, it, vi } from 'vitest';

import { listToOpen } from './tool-navigation.js';

const EVERYTHING = { withoutDays: 'everything', timeZone: 'UTC' } as const;

describe('listToOpen', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the arguments the list takes, as the list URL carries them', () => {
    expect(
      listToOpen('sessions', { q: 'react', almostFull: true, show: true, limit: 5 }, EVERYTHING),
    ).toEqual({ resource: 'sessions', filters: { q: 'react', almostFull: 'true' } });
  });

  it('leaves out a flag that is off', () => {
    expect(listToOpen('sessions', { almostFull: false }, EVERYTHING)).toEqual({
      resource: 'sessions',
      filters: {},
    });
  });

  it('opens a search of what is to come from today, in the user’s time zone', () => {
    vi.useFakeTimers({ now: new Date('2026-11-15T23:30:00Z') });

    expect(
      listToOpen(
        'events',
        { city: 'Tallinn' },
        { withoutDays: 'upcoming', timeZone: 'Europe/Tallinn' },
      ),
    ).toEqual({ resource: 'events', filters: { city: 'Tallinn', startsFrom: '2026-11-16' } });
  });

  it('keeps the days the model chose', () => {
    expect(
      listToOpen(
        'events',
        { startsTo: '2031-11-30' },
        { withoutDays: 'upcoming', timeZone: 'UTC' },
      ),
    ).toEqual({ resource: 'events', filters: { startsTo: '2031-11-30' } });
  });

  it('refuses a filter value the list would not accept', () => {
    expect(listToOpen('events', { startsFrom: '2031-02-30' }, EVERYTHING)).toEqual({
      problem: expect.any(String),
    });
  });
});
