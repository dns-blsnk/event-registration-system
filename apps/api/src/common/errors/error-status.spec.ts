import { ErrorCode } from '@ers/shared';
import { describe, expect, it } from 'vitest';

import { codeForHttpStatus, ERROR_STATUS } from './error-status.js';

describe('ERROR_STATUS', () => {
  it('maps every error code to an HTTP status', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('codeForHttpStatus', () => {
  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [429, 'RATE_LIMITED'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
    [502, 'INTERNAL_ERROR'],
    [405, 'BAD_REQUEST'],
    [415, 'BAD_REQUEST'],
  ])('maps %i to %s', (status, code) => {
    expect(codeForHttpStatus(status)).toBe(code);
  });
});
