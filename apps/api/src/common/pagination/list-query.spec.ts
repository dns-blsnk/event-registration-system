import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors/domain-error.js';

import {
  dateRangeFilter,
  enumFilter,
  integerFilter,
  orderByOf,
  parseListQuery,
} from './list-query.js';

const SPEC = {
  sortable: ['name', 'createdAt'] as const,
  defaultSort: { field: 'createdAt' as const, direction: 'desc' as const },
};

function failureField(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof DomainError ? error.details?.[0]?.field : 'OTHER';
  }
  return undefined;
}

describe('parseListQuery', () => {
  it('uses the first page and the default sort when nothing is given', () => {
    expect(parseListQuery({}, SPEC)).toEqual({
      skip: 0,
      take: 25,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      search: undefined,
    });
  });

  it('reads a range, sort and search', () => {
    expect(
      parseListQuery(
        { _start: '50', _end: '75', _sort: 'name', _order: 'DESC', q: '  anna ' },
        SPEC,
      ),
    ).toEqual({
      skip: 50,
      take: 25,
      sort: [{ field: 'name', direction: 'desc' }],
      search: 'anna',
    });
  });

  it('supports several sort fields', () => {
    expect(parseListQuery({ _sort: 'name,createdAt', _order: 'asc,desc' }, SPEC).sort).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'createdAt', direction: 'desc' },
    ]);
  });

  it('caps the page size', () => {
    expect(parseListQuery({ _start: '0', _end: '100000' }, SPEC).take).toBe(100);
  });

  it('caps the search length', () => {
    expect(parseListQuery({ q: 'x'.repeat(500) }, SPEC).search).toHaveLength(100);
  });

  it.each([
    [{ _start: '-1' }, '_start'],
    [{ _start: 'abc' }, '_start'],
    [{ _start: '10', _end: '10' }, '_end'],
    [{ _sort: 'passwordHash' }, '_sort'],
    [{ _sort: 'name', _order: 'sideways' }, '_order'],
  ])('rejects %j', (query, field) => {
    expect(failureField(() => parseListQuery(query, SPEC))).toBe(field);
  });
});

describe('enumFilter', () => {
  it('returns undefined when the filter is absent or empty', () => {
    expect(enumFilter(undefined, 'role', ['ADMIN'])).toBeUndefined();
    expect(enumFilter('', 'role', ['ADMIN'])).toBeUndefined();
  });

  it('accepts an allowed value', () => {
    expect(enumFilter('ADMIN', 'role', ['ADMIN', 'CUSTOMER'])).toBe('ADMIN');
  });

  it.each(['SUPERUSER', ['ADMIN', 'CUSTOMER']])('rejects %p', (raw) => {
    expect(failureField(() => enumFilter(raw, 'role', ['ADMIN']))).toBe('role');
  });
});

describe('orderByOf', () => {
  it('maps each sort field and appends the id tiebreaker', () => {
    expect(
      orderByOf({
        skip: 0,
        take: 10,
        search: undefined,
        sort: [
          { field: 'name', direction: 'desc' },
          { field: 'createdAt', direction: 'asc' },
        ],
      }),
    ).toEqual([{ name: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }]);
  });
});

describe('orderByOf edge cases', () => {
  const base = { skip: 0, take: 10, search: undefined };

  it('adds the tiebreaker to a single default sort', () => {
    expect(orderByOf({ ...base, sort: [{ field: 'name', direction: 'asc' }] })).toEqual([
      { name: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('does not repeat id when the list is already sorted by it', () => {
    expect(orderByOf({ ...base, sort: [{ field: 'id', direction: 'desc' }] })).toEqual([
      { id: 'desc' },
    ]);
  });

  it('lets a computed field map to its own orderBy and keeps plain fields as columns', () => {
    const query = {
      ...base,
      sort: [
        { field: 'eventCount' as 'eventCount' | 'name', direction: 'desc' as const },
        { field: 'name' as 'eventCount' | 'name', direction: 'asc' as const },
      ],
    };

    expect(
      orderByOf(query, (field, direction) =>
        field === 'eventCount' ? { events: { _count: direction } } : undefined,
      ),
    ).toEqual([{ events: { _count: 'desc' } }, { name: 'asc' }, { id: 'asc' }]);
  });
});

describe('integerFilter', () => {
  const range = { min: 100, max: 599 };

  it('reads a whole number in range', () => {
    expect(integerFilter('503', 'statusCode', range)).toBe(503);
  });

  it.each([undefined, ''])('returns undefined for %p', (raw) => {
    expect(integerFilter(raw, 'statusCode', range)).toBeUndefined();
  });

  it.each(['99', '600', '5.5', '-1', 'abc', '1e3', ['503']])('rejects %p', (raw) => {
    expect(() => integerFilter(raw, 'statusCode', range)).toThrow(DomainError);
  });
});

describe('dateRangeFilter', () => {
  it('returns undefined without either end', () => {
    expect(dateRangeFilter({}, 'from', 'to')).toBeUndefined();
  });

  it('reads both ends', () => {
    expect(
      dateRangeFilter({ from: '2026-11-01T10:00:00Z', to: '2026-11-02T10:00:00Z' }, 'from', 'to'),
    ).toEqual({
      gte: new Date('2026-11-01T10:00:00Z'),
      lte: new Date('2026-11-02T10:00:00Z'),
    });
  });

  it('includes the whole day for a date-only end', () => {
    expect(dateRangeFilter({ to: '2026-11-14' }, 'from', 'to')).toEqual({
      lte: new Date('2026-11-14T23:59:59.999Z'),
    });
  });

  it('rejects a range that ends before it starts', () => {
    try {
      dateRangeFilter({ from: '2026-11-14', to: '2026-11-13' }, 'from', 'to');
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).details).toEqual([
        { field: 'to', messages: ['to must not be before from'] },
      ]);
    }
  });

  it('accepts a single day given as the same date on both ends', () => {
    expect(dateRangeFilter({ from: '2026-11-14', to: '2026-11-14' }, 'from', 'to')).toEqual({
      gte: new Date('2026-11-14T00:00:00Z'),
      lte: new Date('2026-11-14T23:59:59.999Z'),
    });
  });
});
