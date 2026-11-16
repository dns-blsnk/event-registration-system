import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  FAILED_LOGIN_WINDOW_MS,
  LoginAttemptLimiter,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_CLIENT,
} from '../../src/modules/auth/login-attempt-limiter.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

const EXPIRY_WAIT_MS = 20;
const PARALLEL_GUESSES = 30;

function newEmail(): string {
  return `${randomUUID()}@example.com`;
}

/** Keys without the app's namespace, as the client's own commands expect them. */
async function failureKeys(redis: RedisService): Promise<string[]> {
  const prefix = redis.options.keyPrefix ?? '';
  const keys = await redis.keys(`${prefix}login-failures:*`);
  return keys.map((key) => key.slice(prefix.length));
}

describe('LoginAttemptLimiter in Redis', () => {
  let app: INestApplication;
  let limiter: LoginAttemptLimiter;
  let redis: RedisService;

  async function attempt(ip: string, email: string, times: number): Promise<boolean[]> {
    const results = [];
    for (let index = 0; index < times; index += 1) {
      results.push(await limiter.allowAttempt(ip, email));
    }
    return results;
  }

  beforeAll(async () => {
    app = await createTestApp();
    limiter = app.get(LoginAttemptLimiter);
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the per-client number of attempts, then refuses the next one', async () => {
    const results = await attempt('ip1', newEmail(), MAX_FAILURES_PER_CLIENT + 1);

    expect(results.slice(0, MAX_FAILURES_PER_CLIENT).every(Boolean)).toBe(true);
    expect(results[MAX_FAILURES_PER_CLIENT]).toBe(false);
  });

  it('lets only the allowed number of parallel guesses through', async () => {
    const email = newEmail();

    const results = await Promise.all(
      Array.from({ length: PARALLEL_GUESSES }, () => limiter.allowAttempt('ip1', email)),
    );

    expect(results.filter(Boolean)).toHaveLength(MAX_FAILURES_PER_CLIENT);
  });

  it('does not refuse other clients or other accounts at the per-client limit', async () => {
    const email = newEmail();
    await attempt('ip1', email, MAX_FAILURES_PER_CLIENT + 1);

    expect(await limiter.allowAttempt('ip2', email)).toBe(true);
    expect(await limiter.allowAttempt('ip1', newEmail())).toBe(true);
  });

  it('refuses an account attacked from many addresses', async () => {
    const email = newEmail();
    for (let index = 0; index < MAX_FAILURES_PER_ACCOUNT; index += 1) {
      await limiter.allowAttempt(`2001:db8::${String(index)}`, email);
    }

    expect(await limiter.allowAttempt('2001:db8::fresh', email)).toBe(false);
  });

  it('allows attempts again when the window has passed', async () => {
    const email = newEmail();
    await attempt('ip', email, MAX_FAILURES_PER_CLIENT + 1);
    for (const key of await failureKeys(redis)) await redis.pexpire(key, 1);
    await sleep(EXPIRY_WAIT_MS);

    expect(await limiter.allowAttempt('ip', email)).toBe(true);
  });

  it('clears both counters after a successful login', async () => {
    const email = newEmail();
    await attempt('ip', email, MAX_FAILURES_PER_CLIENT);
    await limiter.recordSuccess('ip', email);

    expect(await attempt('ip', email, MAX_FAILURES_PER_CLIENT)).toEqual(
      Array.from({ length: MAX_FAILURES_PER_CLIENT }, () => true),
    );
  });
});

/** Each case reads raw Redis keys, so it gets an app whose key namespace holds nothing else. */
describe('LoginAttemptLimiter keys', () => {
  let app: INestApplication;
  let limiter: LoginAttemptLimiter;
  let redis: RedisService;

  beforeEach(async () => {
    app = await createTestApp();
    limiter = app.get(LoginAttemptLimiter);
    redis = app.get(RedisService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('starts the window at the first attempt and does not extend it', async () => {
    const email = newEmail();
    await limiter.allowAttempt('ip', email);
    const keys = await failureKeys(redis);
    for (const key of keys) await redis.pexpire(key, FAILED_LOGIN_WINDOW_MS / 2);

    await limiter.allowAttempt('ip', email);

    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(await redis.pttl(key)).toBeLessThanOrEqual(FAILED_LOGIN_WINDOW_MS / 2);
    }
  });

  it('gives every counter an expiry with its first attempt', async () => {
    await limiter.allowAttempt('ip', newEmail());

    for (const key of await failureKeys(redis)) {
      expect(await redis.pttl(key)).toBeGreaterThan(0);
    }
  });

  it('keeps neither the email nor the IP in Redis keys', async () => {
    const email = newEmail();
    await limiter.allowAttempt('203.0.113.7', email);

    const keys = await failureKeys(redis);
    expect(keys).toHaveLength(2);
    expect(keys.some((key) => key.includes(email) || key.includes('203.0.113.7'))).toBe(false);
  });
});
