import { ErrorCode } from '@ers/shared';

import { Prisma } from '../../generated/prisma/client.js';

import { DomainError } from './domain-error.js';

/** Database unreachable, connection dropped mid-request, pool exhausted or server shutting down. */
const UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  '57P01',
  '57P03',
]);

function codeOf(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return undefined;
}

/** True for any database connectivity failure, whether Prisma wrapped it or the driver threw it raw. */
function isUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof AggregateError) {
    // Node reports a refused localhost connection (IPv4 + IPv6) as an AggregateError.
    return error.errors.some(isUnavailable);
  }
  const code = codeOf(error);
  return code !== undefined && UNAVAILABLE_CODES.has(code);
}

const CHECK_VIOLATION = '23514';

/** Public meaning of each CHECK constraint, so a violation is a clear 4xx instead of a 500. */
const CHECK_CONSTRAINT_ERRORS: Readonly<
  Record<string, { code: ErrorCode; message: string; field?: string }>
> = {
  events_dates_check: {
    code: ErrorCode.VALIDATION_FAILED,
    message: 'The end must be after the start',
    field: 'endsAt',
  },
  sessions_dates_check: {
    code: ErrorCode.VALIDATION_FAILED,
    message: 'The end must be after the start',
    field: 'endsAt',
  },
  sessions_capacity_check: {
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Capacity must be positive',
    field: 'capacity',
  },
  sessions_confirmed_count_check: {
    code: ErrorCode.CONFLICT,
    message: 'Capacity cannot be lower than the number of confirmed seats',
  },
  tags_name_check: {
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Tag name cannot start or end with spaces',
    field: 'name',
  },
  users_email_normalised_check: {
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Email must be normalised',
    field: 'email',
  },
};

interface DriverCause {
  code?: unknown;
  message?: unknown;
}

function driverCauseOf(error: Prisma.PrismaClientKnownRequestError): DriverCause | undefined {
  const meta = error.meta as { driverAdapterError?: { cause?: DriverCause } } | undefined;
  return meta?.driverAdapterError?.cause;
}

/** Translates a Postgres CHECK violation into the constraint's public error. */
function checkViolationError(error: Prisma.PrismaClientKnownRequestError): DomainError | undefined {
  const cause = driverCauseOf(error);
  if (cause?.code !== CHECK_VIOLATION || typeof cause.message !== 'string') {
    return undefined;
  }
  const constraint = /check constraint "([a-z_]+)"/.exec(cause.message)?.[1] ?? '';
  const known = CHECK_CONSTRAINT_ERRORS[constraint];
  if (known === undefined) {
    return new DomainError(ErrorCode.VALIDATION_FAILED, 'The data breaks a business rule');
  }
  const details =
    known.field === undefined ? undefined : [{ field: known.field, messages: [known.message] }];
  return new DomainError(known.code, known.message, details);
}

/**
 * Maps database failures to domain errors; returns undefined for anything else.
 * P2003 means a referenced row is missing or still referenced; services check references
 * explicitly when they can answer NOT_FOUND, so a P2003 reaching here is a conflict.
 */
export function translatePrismaError(error: unknown): DomainError | undefined {
  if (isUnavailable(error)) {
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Database unavailable');
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }
  const checkError = checkViolationError(error);
  if (checkError !== undefined) {
    return checkError;
  }
  switch (error.code) {
    case 'P2002':
      return new DomainError(ErrorCode.CONFLICT, 'A record with these values already exists');
    case 'P2003':
      return new DomainError(ErrorCode.CONFLICT, 'A related record is missing or still in use');
    case 'P2025':
      return new DomainError(ErrorCode.NOT_FOUND, 'Record not found');
    case 'P2028':
    case 'P2034':
      // Transaction expired while waiting for a lock (P2028), or a write conflict/deadlock (P2034).
      return new DomainError(
        ErrorCode.CONFLICT,
        'The data changed while saving. Please try again.',
      );
    default:
      return undefined;
  }
}
