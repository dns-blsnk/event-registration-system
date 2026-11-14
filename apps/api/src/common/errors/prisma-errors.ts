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
  switch (error.code) {
    case 'P2002':
      return new DomainError(ErrorCode.CONFLICT, 'A record with these values already exists');
    case 'P2003':
      return new DomainError(ErrorCode.CONFLICT, 'A related record is missing or still in use');
    case 'P2025':
      return new DomainError(ErrorCode.NOT_FOUND, 'Record not found');
    default:
      return undefined;
  }
}
