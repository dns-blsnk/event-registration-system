import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { MINUTE_MS } from '../../../common/time.js';
import { countHits } from '../../../redis/fixed-window.js';
import { RedisService } from '../../../redis/redis.service.js';

const FAILED_LOGIN_WINDOW_MINUTES = 15;
export const FAILED_LOGIN_WINDOW_MS = FAILED_LOGIN_WINDOW_MINUTES * MINUTE_MS;

/** Failures allowed per client IP and email: stops guessing one account from one place. */
export const MAX_FAILURES_PER_CLIENT = 5;
/**
 * Failures allowed per email from anywhere: stops attackers who rotate addresses (an IPv6 /64,
 * a botnet). Higher than the per-client limit so one client cannot easily lock others out.
 */
export const MAX_FAILURES_PER_ACCOUNT = 20;

const CLIENT_KEY_PREFIX = 'login-failures:client:';
const ACCOUNT_KEY_PREFIX = 'login-failures:account:';

/** Keys hold a hash, not the email or IP, so Redis never stores who tried to sign in. */
function digest(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function keysFor(clientIp: string, email: string): [client: string, account: string] {
  return [
    `${CLIENT_KEY_PREFIX}${digest(`${clientIp}\n${email}`)}`,
    `${ACCOUNT_KEY_PREFIX}${digest(email)}`,
  ];
}

/**
 * Brute-force protection for login, by (client IP, email) and by email alone. Every attempt is
 * counted before the password is checked, so parallel guesses cannot all slip under the limit;
 * a correct password clears both counters. Each counter is a fixed window from its first attempt.
 * In Redis, so every API instance counts the same attempts.
 */
@Injectable()
export class LoginAttemptLimiter {
  constructor(private readonly redis: RedisService) {}

  /** Counts this attempt; false when it goes over a limit and the password must not be checked. */
  async allowAttempt(clientIp: string, email: string): Promise<boolean> {
    const [client = 0, account = 0] = await countHits(
      this.redis,
      keysFor(clientIp, email),
      FAILED_LOGIN_WINDOW_MS,
    );
    return client <= MAX_FAILURES_PER_CLIENT && account <= MAX_FAILURES_PER_ACCOUNT;
  }

  async recordSuccess(clientIp: string, email: string): Promise<void> {
    await this.redis.del(...keysFor(clientIp, email));
  }
}
