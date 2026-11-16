import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RedisThrottlerStorage } from '../../src/common/auth/redis-throttler-storage.js';
import { MINUTE_MS } from '../../src/common/time.js';
import { parseConfig } from '../../src/config/config.schema.js';
import { ChatAdmission, MESSAGES_PER_MINUTE } from '../../src/modules/chat/chat-admission.js';
import { countHits } from '../../src/redis/fixed-window.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { silentLogger } from '../helpers/silent-logger.js';
import { DEAD_REDIS_URL, TEST_ENV } from '../helpers/test-env.js';

import type { INestApplication } from '@nestjs/common';

const WINDOW_MS = 60_000;
const LIMIT = 3;
const BLOCK_MS = 30_000;
const PARALLEL_HITS = 25;

describe('fixed-window hit counters', () => {
  let app: INestApplication;
  let redis: RedisService;

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('counts hits per key, in key order', async () => {
    const [first, second] = [`a:${randomUUID()}`, `b:${randomUUID()}`];
    await countHits(redis, [first], WINDOW_MS);

    expect(await countHits(redis, [first, second], WINDOW_MS)).toEqual([2, 1]);
  });

  it('gives every parallel caller its own count', async () => {
    const key = `parallel:${randomUUID()}`;

    const counts = await Promise.all(
      Array.from({ length: PARALLEL_HITS }, () => countHits(redis, [key], WINDOW_MS)),
    );

    expect(counts.map(([count]) => count).sort((a = 0, b = 0) => a - b)).toEqual(
      Array.from({ length: PARALLEL_HITS }, (_, index) => index + 1),
    );
  });

  it('starts the window at the first hit and does not extend it', async () => {
    const key = `window:${randomUUID()}`;
    await countHits(redis, [key], WINDOW_MS);
    await redis.pexpire(key, WINDOW_MS / 2);

    await countHits(redis, [key], WINDOW_MS);

    const left = await redis.pttl(key);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(WINDOW_MS / 2);
  });
});

describe('RedisThrottlerStorage', () => {
  let app: INestApplication;
  let storage: RedisThrottlerStorage;

  beforeAll(async () => {
    app = await createTestApp();
    storage = new RedisThrottlerStorage(app.get(RedisService));
  });

  afterAll(async () => {
    await app.close();
  });

  async function hit(key: string) {
    return storage.increment(key, WINDOW_MS, LIMIT, BLOCK_MS, 'default');
  }

  it('counts hits and reports the seconds left in the window', async () => {
    const key = randomUUID();
    await hit(key);

    expect(await hit(key)).toEqual({
      totalHits: 2,
      timeToExpire: WINDOW_MS / 1000,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('blocks a key once it passes the limit, for the block duration', async () => {
    const key = randomUUID();
    for (let index = 0; index < LIMIT; index += 1) await hit(key);

    expect(await hit(key)).toMatchObject({ isBlocked: true, timeToBlockExpire: BLOCK_MS / 1000 });
    expect(await hit(key)).toMatchObject({ isBlocked: true });
  });

  it('never blocks when the throttler asks for no block, and still reports the hits', async () => {
    const key = randomUUID();
    for (let index = 0; index < LIMIT; index += 1) {
      await storage.increment(key, WINDOW_MS, LIMIT, 0, 'default');
    }

    expect(await storage.increment(key, WINDOW_MS, LIMIT, 0, 'default')).toMatchObject({
      totalHits: LIMIT + 1,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('lets requests through while Redis cannot be reached', async () => {
    const deadRedis = new RedisService(
      parseConfig({ ...TEST_ENV, REDIS_URL: DEAD_REDIS_URL }),
      silentLogger,
    );
    const offline = new RedisThrottlerStorage(deadRedis);

    const record = await offline.increment(randomUUID(), WINDOW_MS, LIMIT, BLOCK_MS, 'default');
    deadRedis.disconnect();

    expect(record).toMatchObject({ isBlocked: false, totalHits: 0 });
  });
});

describe('limits shared across API instances', () => {
  const sharedPrefix = `test:${randomUUID()}:`;
  let first: INestApplication;
  let second: INestApplication;

  beforeAll(async () => {
    first = await createTestApp({ redisKeyPrefix: sharedPrefix });
    second = await createTestApp({ redisKeyPrefix: sharedPrefix });
  });

  afterAll(async () => {
    await Promise.all([first.close(), second.close()]);
  });

  it('counts a user’s chat messages on every instance together', async () => {
    const userId = randomUUID();
    for (let index = 0; index < MESSAGES_PER_MINUTE; index += 1) {
      const app = index % 2 === 0 ? first : second;
      expect(await app.get(ChatAdmission).isWithinLimit(userId)).toBe(true);
    }

    expect(await second.get(ChatAdmission).isWithinLimit(userId)).toBe(false);
  });

  it('blocks a throttled key on another instance', async () => {
    const key = randomUUID();
    const onFirst = new RedisThrottlerStorage(first.get(RedisService));
    const onSecond = new RedisThrottlerStorage(second.get(RedisService));
    for (let index = 0; index <= LIMIT; index += 1) {
      await onFirst.increment(key, MINUTE_MS, LIMIT, BLOCK_MS, 'default');
    }

    expect(await onSecond.increment(key, MINUTE_MS, LIMIT, BLOCK_MS, 'default')).toMatchObject({
      isBlocked: true,
    });
  });
});
