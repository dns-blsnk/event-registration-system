import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors/domain-error.js';

import { enumFilter, parseListQuery } from './list-query.js';

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
