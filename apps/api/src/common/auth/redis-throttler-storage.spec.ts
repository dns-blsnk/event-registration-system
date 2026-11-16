import { describe, expect, it } from 'vitest';

import { RedisThrottlerStorage } from './redis-throttler-storage.js';

import type { RedisService } from '../../redis/redis.service.js';

function storageFailingWith(error: Error): RedisThrottlerStorage {
  return new RedisThrottlerStorage({
    eval: () => Promise.reject(error),
  } as unknown as RedisService);
}

describe('RedisThrottlerStorage', () => {
  it('fails the request on a Redis error that is not an outage, so a bug is not hidden', async () => {
    const bug = new Error('ERR Error running script');

    await expect(storageFailingWith(bug).increment('k', 1000, 1, 1000, 'default')).rejects.toBe(
      bug,
    );
  });

  it('lets the request through when Redis does not reply in time', async () => {
    const record = await storageFailingWith(new Error('Command timed out')).increment(
      'k',
      1000,
      1,
      1000,
      'default',
    );

    expect(record).toEqual({
      totalHits: 0,
      timeToExpire: 1,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });
});
