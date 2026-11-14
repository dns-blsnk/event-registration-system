import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';

import { DomainError } from './domain-error.js';
import { prismaErrorCode, translatePrismaError } from './prisma-errors.js';
import { toErrorResponse } from './to-error-response.js';

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma failure', {
    code,
    clientVersion: '7.10.1',
  });
}

describe('translatePrismaError', () => {
  it.each([
    ['P2002', 'CONFLICT'],
    ['P2003', 'CONFLICT'],
    ['P2025', 'NOT_FOUND'],
    ['P2028', 'CONFLICT'],
    ['P2034', 'CONFLICT'],
  ])('maps %s to %s', (prismaCode, errorCode) => {
    expect(translatePrismaError(knownError(prismaCode))?.code).toBe(errorCode);
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'P1001', 'P1017', 'P2024', '57P01'])(
    'treats %s as the database being unavailable',
    (code) => {
      expect(translatePrismaError(knownError(code))?.code).toBe('SERVICE_UNAVAILABLE');
    },
  );

  it('treats a client initialization failure as unavailable', () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server",
      '7.10.1',
    );

    expect(translatePrismaError(error)?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('treats a raw driver connection error as unavailable', () => {
    const raw = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });

    expect(translatePrismaError(raw)?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('treats a dual-stack localhost refusal (AggregateError) as unavailable', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED ::1:5432'), {
      code: 'ECONNREFUSED',
    });

    expect(translatePrismaError(new AggregateError([refused]))?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('leaves unknown Prisma codes untranslated', () => {
    expect(translatePrismaError(knownError('P2000'))).toBeUndefined();
  });

  it('ignores errors that are not from Prisma', () => {
    expect(translatePrismaError(new Error('x'))).toBeUndefined();
    expect(translatePrismaError(new DomainError('CONFLICT', 'x'))).toBeUndefined();
  });
});

describe('toErrorResponse with Prisma errors', () => {
  it('answers a dropped database connection with 503 and no internals', () => {
    const { body, isServerError } = toErrorResponse(knownError('ECONNREFUSED'), 'req-1');

    expect(isServerError).toBe(true);
    expect(body).toEqual({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is temporarily unavailable. Please try again shortly.',
      requestId: 'req-1',
    });
  });

  it('answers a unique violation with 409', () => {
    expect(toErrorResponse(knownError('P2002'), 'req-1').body).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });
});

function checkViolation(constraint: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('check failed', {
    code: 'P2039',
    clientVersion: '7.10.1',
    meta: {
      driverAdapterError: {
        cause: {
          code: '23514',
          message: `new row for relation "x" violates check constraint "${constraint}"`,
        },
      },
    },
  });
}

describe('CHECK constraint violations', () => {
  it.each([
    ['events_dates_check', 'VALIDATION_FAILED', 'endsAt'],
    ['sessions_capacity_check', 'VALIDATION_FAILED', 'capacity'],
    ['tags_name_check', 'VALIDATION_FAILED', 'name'],
  ])('maps %s to %s on field %s', (constraint, code, field) => {
    const error = translatePrismaError(checkViolation(constraint));

    expect(error?.code).toBe(code);
    expect(error?.details?.[0]?.field).toBe(field);
  });

  it('maps lowering capacity below confirmed seats to CONFLICT', () => {
    expect(translatePrismaError(checkViolation('sessions_confirmed_count_check'))?.code).toBe(
      'CONFLICT',
    );
  });

  it('maps an unknown check constraint to a generic validation error, never a 500', () => {
    const { body, isServerError } = toErrorResponse(checkViolation('something_new_check'), 'req-1');

    expect(isServerError).toBe(false);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.message).not.toContain('something_new_check');
  });
});

describe('prismaErrorCode', () => {
  it('returns the code of a known request error', () => {
    expect(prismaErrorCode(knownError('P2002'))).toBe('P2002');
  });

  it.each([new Error('plain'), 'text', undefined])('returns undefined for %p', (error) => {
    expect(prismaErrorCode(error)).toBeUndefined();
  });
});
