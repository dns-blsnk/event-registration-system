import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@ers/shared';

import { fieldError } from '../errors/field-error.js';

import type { DomainError } from '../errors/domain-error.js';

export type SortDirection = 'asc' | 'desc';

export interface ListQuery<TField extends string> {
  skip: number;
  take: number;
  sort: { field: TField; direction: SortDirection }[];
  /** Free-text search from the `q` parameter, trimmed; undefined when empty. */
  search: string | undefined;
}

/**
 * Prisma `orderBy` for a parsed list query. The id tiebreaker keeps offset pagination stable when
 * sort values repeat. `mapField` translates computed fields (such as a relation count) that are
 * not plain columns; it returns undefined for plain ones.
 */
export function orderByOf<TField extends string, TOrder extends object = never>(
  query: ListQuery<TField>,
  mapField?: (field: TField, direction: SortDirection) => TOrder | undefined,
): (TOrder | Record<string, SortDirection>)[] {
  const fields = query.sort.map(
    ({ field, direction }) => mapField?.(field, direction) ?? { [field]: direction },
  );
  const sortsById = query.sort.some(({ field }) => field === 'id');
  return sortsById ? fields : [...fields, { id: 'asc' }];
}

export interface ListQuerySpec<TField extends string> {
  sortable: readonly TField[];
  defaultSort: { field: TField; direction: SortDirection };
}

const MAX_SEARCH_LENGTH = 100;

type RawQuery = Readonly<Record<string, unknown>>;

function invalid(field: string, message: string): DomainError {
  return fieldError(field, message, 'Invalid list parameters');
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT_FILTER_LENGTH = 100;

/** Reads an optional UUID filter. */
export function uuidFilter(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !UUID_PATTERN.test(raw)) {
    throw invalid(field, `${field} must be a UUID`);
  }
  return raw;
}

const DIGITS_PATTERN = /^\d+$/;

/** Reads an optional whole-number filter within [min, max]. */
export function integerFilter(
  raw: unknown,
  field: string,
  { min, max }: { min: number; max: number },
): number | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const value = typeof raw === 'string' && DIGITS_PATTERN.test(raw) ? Number(raw) : Number.NaN;
  if (Number.isNaN(value) || value < min || value > max) {
    throw invalid(field, `${field} must be a whole number from ${String(min)} to ${String(max)}`);
  }
  return value;
}

/** Reads an optional ISO date filter. */
export function dateFilter(raw: unknown, field: string): Date | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const date = typeof raw === 'string' ? new Date(raw) : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) {
    throw invalid(field, `${field} must be an ISO date`);
  }
  return date;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const END_OF_DAY_SUFFIX = 'T23:59:59.999Z';

export interface DateRange {
  gte?: Date;
  lte?: Date;
}

/**
 * Reads an optional `from`/`to` range from two query fields. A date-only `to` (2026-11-14, as date
 * pickers send) includes that whole day in UTC. A range that ends before it starts is rejected
 * rather than silently matching nothing.
 */
export function dateRangeFilter(
  query: Record<string, unknown>,
  fromField: string,
  toField: string,
): DateRange | undefined {
  const from = dateFilter(query[fromField], fromField);
  const rawTo = query[toField];
  const to = dateFilter(
    typeof rawTo === 'string' && DATE_ONLY_PATTERN.test(rawTo)
      ? `${rawTo}${END_OF_DAY_SUFFIX}`
      : rawTo,
    toField,
  );
  if (from !== undefined && to !== undefined && to.getTime() < from.getTime()) {
    throw invalid(toField, `${toField} must not be before ${fromField}`);
  }
  if (from === undefined && to === undefined) {
    return undefined;
  }
  return { ...(from === undefined ? {} : { gte: from }), ...(to === undefined ? {} : { lte: to }) };
}

/** Reads an optional exact-match text filter (trimmed, length-capped). */
export function textFilter(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw invalid(field, `${field} must be a string`);
  }
  const value = raw.trim().slice(0, MAX_TEXT_FILTER_LENGTH);
  return value === '' ? undefined : value;
}
