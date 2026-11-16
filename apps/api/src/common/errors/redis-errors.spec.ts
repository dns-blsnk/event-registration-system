import { MaxRetriesPerRequestError } from 'ioredis/built/errors/index.js';
import { describe, expect, it } from 'vitest';

import { translateRedisError } from './redis-errors.js';

describe('translateRedisError', () => {
  it.each([
    ['no connection after the allowed reconnect', new MaxRetriesPerRequestError(1)],
    ['no reply within the command timeout', new Error('Command timed out')],
    ['the connection closed under a pending command', new Error('Connection is closed.')],
    [
      'a full Redis refusing a write',
      new Error("OOM command not allowed when used memory > 'maxmemory'."),
    ],
  ])('turns %s into a 503 that keeps the original as its cause', (_case, error) => {
    const translated = translateRedisError(error);

    expect(translated).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(translated?.cause).toBe(error);
  });

  it.each([
    ['a reply error from a reachable Redis', new Error('WRONGTYPE Operation against a key')],
    ['a value that is not an error', 'Command timed out'],
  ])('leaves %s alone, so it is reported as a bug', (_case, error) => {
    expect(translateRedisError(error)).toBeUndefined();
  });
});
