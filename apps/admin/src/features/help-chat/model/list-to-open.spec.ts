import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { describeFilters, describeList, listFilterValues } from './list-to-open';

describe('listFilterValues', () => {
  it('turns days into the first and last moment of the day, in the viewer’s zone', () => {
    expect(
      listFilterValues({
        resource: 'events',
        filters: { city: 'Tallinn', startsFrom: '2026-11-16', startsTo: '2026-11-30' },
      }),
    ).toEqual({
      city: 'Tallinn',
      startsFrom: dayjs('2026-11-16').startOf('day').toISOString(),
      startsTo: dayjs('2026-11-30').endOf('day').toISOString(),
    });
  });

  it('keeps ids, statuses and text as they are', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const filters = { status: 'WAITLISTED', eventId: id };

    expect(listFilterValues({ resource: 'registrations', filters })).toEqual(filters);
  });
});

describe('describeList', () => {
  it('names the list and its filters, or just the list', () => {
    expect(describeList({ resource: 'events', filters: { city: 'Tallinn' } }, 'Events')).toBe(
      'Events: City: Tallinn',
    );
    expect(describeList({ resource: 'customers', filters: {} }, 'Customers')).toBe('Customers');
  });
});

describe('describeFilters', () => {
  it('names each filter as the list does, with readable values', () => {
    expect(
      describeFilters({
        resource: 'events',
        filters: { city: 'Tallinn', status: 'PUBLISHED', startsFrom: '2026-11-16' },
      }),
    ).toBe('City: Tallinn, Status: Published, Starts from 16 Nov 2026');
  });

  it('uses the registration status labels on registration lists', () => {
    expect(
      describeFilters({ resource: 'my-registrations', filters: { status: 'CONFIRMED' } }),
    ).toBe('Status: Confirmed');
  });

  it('names an id or a yes-only filter instead of showing its value', () => {
    expect(
      describeFilters({
        resource: 'sessions',
        filters: { eventId: '11111111-1111-4111-8111-111111111111', almostFull: 'true' },
      }),
    ).toBe('Event, Almost full');
  });

  it('is empty for a list without filters', () => {
    expect(describeFilters({ resource: 'customers', filters: {} })).toBe('');
  });
});
