import { ErrorCode } from '@ers/shared';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DomainError } from './domain-error.js';
import { toErrorResponse } from './to-error-response.js';

const REQUEST_ID = 'req-1';
const GENERIC = 'Something went wrong. Please try again later.';

describe('toErrorResponse', () => {
  it('maps a domain error to its status, code, message and details', () => {
    const details = [{ field: 'email', messages: ['email must be an email'] }];
    const { body, isServerError } = toErrorResponse(
      new DomainError(ErrorCode.VALIDATION_FAILED, 'Validation failed', details),
      REQUEST_ID,
    );

    expect(isServerError).toBe(false);
    expect(body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details,
      requestId: REQUEST_ID,
    });
  });

  it('omits details when a domain error has none', () => {
    const { body } = toErrorResponse(new DomainError(ErrorCode.CONFLICT, 'Taken'), REQUEST_ID);

    expect(body).not.toHaveProperty('details');
    expect(body.statusCode).toBe(409);
  });

  it('hides the message of a 5xx domain error', () => {
    const { body, isServerError } = toErrorResponse(
      new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'db host 10.0.0.5 unreachable'),
      REQUEST_ID,
    );

    expect(isServerError).toBe(true);
    expect(body.statusCode).toBe(503);
    expect(body.message).toBe('The service is temporarily unavailable. Please try again shortly.');
    expect(body.message).not.toContain('10.0.0.5');
  });

  it('maps Nest HTTP exceptions to error codes', () => {
    expect(toErrorResponse(new NotFoundException('Cannot GET /x'), REQUEST_ID).body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /x',
    });
    expect(toErrorResponse(new BadRequestException(), REQUEST_ID).body.code).toBe('BAD_REQUEST');
  });

  it('joins array messages from Nest exceptions', () => {
    const { body } = toErrorResponse(
      new BadRequestException(['seats must be positive', 'title is required']),
      REQUEST_ID,
    );

    expect(body.message).toBe('seats must be positive; title is required');
  });

  it('answers body-parser failures with a fixed message that never quotes the body', () => {
    const parseError = Object.assign(
      new SyntaxError('Unexpected token in JSON: {"password":"hunter2'),
      {
        status: 400,
        type: 'entity.parse.failed',
      },
    );

    const { body, isServerError } = toErrorResponse(parseError, REQUEST_ID);

    expect(isServerError).toBe(false);
    expect(body).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Request body is not valid JSON',
      requestId: REQUEST_ID,
    });
  });

  it('unwraps body-parser failures that Nest wraps in BadRequestException', () => {
    const cause = Object.assign(
      new SyntaxError('... "{\\"password\\":\\"hunter2" is not valid JSON'),
      {
        status: 400,
        type: 'entity.parse.failed',
      },
    );

    const { body } = toErrorResponse(new BadRequestException(cause.message, { cause }), REQUEST_ID);

    expect(body.message).toBe('Request body is not valid JSON');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('maps an oversized body to PAYLOAD_TOO_LARGE', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
    });

    expect(toErrorResponse(tooLarge, REQUEST_ID).body).toMatchObject({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    });
  });

  it('uses a generic message for unknown transport errors', () => {
    const unknown = Object.assign(new Error('raw detail'), { status: 406 });

    expect(toErrorResponse(unknown, REQUEST_ID).body).toMatchObject({
      statusCode: 406,
      code: 'BAD_REQUEST',
      message: 'Request could not be processed',
    });
  });

  it('hides the message of a 5xx HTTP exception', () => {
    const { body, isServerError } = toErrorResponse(
      new HttpException('boom internals', 502),
      REQUEST_ID,
    );

    expect(isServerError).toBe(true);
    expect(body).toMatchObject({ statusCode: 502, code: 'INTERNAL_ERROR', message: GENERIC });
  });

  it.each([new Error('secret stack detail'), 'string thrown', null, { weird: true }])(
    'turns an unexpected %p into a generic 500 without internals',
    (thrown) => {
      const { body, isServerError } = toErrorResponse(thrown, REQUEST_ID);

      expect(isServerError).toBe(true);
      expect(body).toEqual({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: GENERIC,
        requestId: REQUEST_ID,
      });
    },
  );
});
