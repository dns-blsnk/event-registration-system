import { DEFAULT_PAGE_SIZE, ErrorCode, MAX_PAGE_SIZE } from '@ers/shared';

import { DomainError } from '../errors/domain-error.js';

export type SortDirection = 'asc' | 'desc';

export interface ListQuery<TField extends string> {
  skip: number;
  take: number;
  sort: { field: TField; direction: SortDirection }[];
  /** Free-text search from the `q` parameter, trimmed; undefined when empty. */
  search: string | undefined;
}

export interface ListQuerySpec<TField extends string> {
  sortable: readonly TField[];
  defaultSort: { field: TField; direction: SortDirection };
}

const MAX_SEARCH_LENGTH = 100;

type RawQuery = Readonly<Record<string, unknown>>;

function invalid(field: string, message: string): DomainError {
  return new DomainError(ErrorCode.VALIDATION_FAILED, 'Invalid list parameters', [
    { field, messages: [message] },
  ]);
}

function nonNegativeInt(raw: unknown, field: string, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const value = typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (!Number.isInteger(value) || value < 0) {
    throw invalid(field, `${field} must be a non-negative integer`);
  }
  return value;
}

function csv(raw: unknown): string[] {
  return typeof raw === 'string' && raw !== '' ? raw.split(',') : [];
}

function parseSort<TField extends string>(
  query: RawQuery,
  spec: ListQuerySpec<TField>,
): ListQuery<TField>['sort'] {
  const fields = csv(query._sort);
  const orders = csv(query._order);
  if (fields.length === 0) {
    return [spec.defaultSort];
  }
  return fields.map((field, index) => {
    if (!(spec.sortable as readonly string[]).includes(field)) {
      throw invalid('_sort', `cannot sort by ${field}`);
    }
    const order = (orders[index] ?? 'asc').toLowerCase();
    if (order !== 'asc' && order !== 'desc') {
      throw invalid('_order', '_order must be asc or desc');
    }
    return { field: field as TField, direction: order };
  });
}

/**
 * Parses Refine simple-rest list parameters: _start/_end (half-open range), _sort/_order
 * (comma-separated, allow-listed fields only) and q (search). Page size is capped.
 */
export function parseListQuery<TField extends string>(
  query: RawQuery,
  spec: ListQuerySpec<TField>,
): ListQuery<TField> {
  const start = nonNegativeInt(query._start, '_start', 0);
  const end = nonNegativeInt(query._end, '_end', start + DEFAULT_PAGE_SIZE);
  if (end <= start) {
    throw invalid('_end', '_end must be greater than _start');
  }
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, MAX_SEARCH_LENGTH) : '';
  return {
    skip: start,
    take: Math.min(end - start, MAX_PAGE_SIZE),
    sort: parseSort(query, spec),
    search: search === '' ? undefined : search,
  };
}

/** Reads an optional filter that must be one of the allowed values. */
export function enumFilter<T extends string>(
  raw: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
    throw invalid(field, `${field} must be one of ${allowed.join(', ')}`);
  }
  return raw as T;
}
