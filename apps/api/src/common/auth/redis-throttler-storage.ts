import { countHitWithBlock } from '../../redis/fixed-window.js';
import { translateRedisError } from '../errors/redis-errors.js';
import { SECOND_MS } from '../time.js';

import type { RedisService } from '../../redis/redis.service.js';
import type { ThrottlerStorage } from '@nestjs/throttler';

/** The record type is not exported from the package root, so it is taken from the interface. */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const HITS_KEY_PREFIX = 'throttle:';
const BLOCK_KEY_PREFIX = 'throttle-block:';

function toSeconds(ms: number): number {
  return Math.ceil(ms / SECOND_MS);
}

/**
 * Rate-limit counters for @nestjs/throttler in Redis, so a limit holds across API instances
 * instead of multiplying by their number. The throttler hands over a key that already hashes the
 * route, the throttler's name and the client.
 *
 * When Redis cannot be reached, the request is let through rather than failing: these are broad
 * per-IP limits, and every route would otherwise answer 503 during an outage. Sign-in and the chat
 * keep their own Redis counters, which refuse instead. The outage itself is logged by RedisService.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  /** The parameter list is fixed by ThrottlerStorage, so it is taken from there as one tuple. */
  async increment(
    ...[key, ttl, limit, blockDuration]: Parameters<ThrottlerStorage['increment']>
  ): Promise<ThrottlerStorageRecord> {
    try {
      const { hits, windowLeftMs, blockLeftMs } = await countHitWithBlock(
        this.redis,
        { counter: `${HITS_KEY_PREFIX}${key}`, block: `${BLOCK_KEY_PREFIX}${key}` },
        { windowMs: ttl, limit, blockMs: blockDuration },
      );
      return {
        totalHits: hits,
        timeToExpire: toSeconds(windowLeftMs),
        isBlocked: blockLeftMs > 0,
        timeToBlockExpire: toSeconds(blockLeftMs),
      };
    } catch (error) {
      if (translateRedisError(error) === undefined) throw error;
      // Recovered on purpose, see the class comment: an unreachable Redis lets the request through.
      return { totalHits: 0, timeToExpire: toSeconds(ttl), isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
