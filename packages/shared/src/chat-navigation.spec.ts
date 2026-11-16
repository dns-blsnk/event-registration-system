import { describe, expect, it } from 'vitest';

import { chatFiltersProblem, isChatNavigableResource, isTimeZone } from './chat-navigation.js';
import { LIST_TEXT_FILTER_MAX_LENGTH } from './lists.js';

const EVENT_ID = '0b9f7f3c-6a35-4c2e-9d8e-2f1a5b7c9d10';

describe('chat navigation', () => {
  it('accepts the filters a list endpoint takes, in their own formats', () => {
    expect(
      chatFiltersProblem('events', {
        q: 'summit',
        city: 'Tallinn',
        status: 'PUBLISHED',
        tagId: EVENT_ID,
        startsFrom: '2026-11-16',
        startsTo: '2026-11-30',
      }),
    ).toBeUndefined();
    expect(
      chatFiltersProblem('sessions', { almostFull: 'true', eventId: EVENT_ID }),
    ).toBeUndefined();
    expect(chatFiltersProblem('my-registrations', { status: 'WAITLISTED' })).toBeUndefined();
  });

  it.each([
    ['an empty search', { q: '  ' }],
    ['an overlong search', { q: 'x'.repeat(LIST_TEXT_FILTER_MAX_LENGTH + 1) }],
    ['a search with a line break', { q: 'summit\nmore' }],
    ['a day in another format', { startsFrom: '16.11.2026' }],
    ['a month that does not exist', { startsFrom: '2026-13-01' }],
    ['a day that does not exist', { startsTo: '2026-02-30' }],
    ['a value that is not a string', { city: 42 }],
    ['an inherited object key', { constructor: 'x' }],
    ['an id that is not a UUID', { tagId: 'abc' }],
    ['a status the list does not have', { status: 'OPEN' }],
    ['a filter the list does not have', { almostFull: 'true' }],
  ])('refuses %s', (_case, filters: Record<string, unknown>) => {
    expect(chatFiltersProblem('events', filters)).toEqual(expect.any(String));
  });

  it('refuses a start range that ends before it begins', () => {
    expect(
      chatFiltersProblem('catalog', { startsFrom: '2026-12-10', startsTo: '2026-12-01' }),
    ).toBe('The start range ends before it begins.');
  });

  it('measures a search without the spaces around it', () => {
    expect(
      chatFiltersProblem('events', { q: ` ${'x'.repeat(LIST_TEXT_FILTER_MAX_LENGTH)} ` }),
    ).toBeUndefined();
  });

  it.each(['Europe/Tallinn', 'UTC', 'America/New_York'])('accepts the time zone %s', (zone) => {
    expect(isTimeZone(zone)).toBe(true);
  });

  it.each(['Mars/Olympus', '', 'x'.repeat(65), 42])('refuses the time zone %s', (zone) => {
    expect(isTimeZone(zone)).toBe(false);
  });

  it('takes no filters at all, which opens the plain list', () => {
    expect(chatFiltersProblem('customers', {})).toBeUndefined();
  });

  it.each(['events', 'sessions', 'registrations', 'customers', 'catalog', 'my-registrations'])(
    'lets the assistant open %s',
    (resource) => {
      expect(isChatNavigableResource(resource)).toBe(true);
    },
  );

  it.each(['users', 'app-logs', 'tags', 'toString', 'constructor'])(
    'never opens %s',
    (resource) => {
      expect(isChatNavigableResource(resource)).toBe(false);
    },
  );
});
