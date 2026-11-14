import { describe, expect, it } from 'vitest';

import {
  FAILED_LOGIN_WINDOW_MS,
  FailureCounter,
  LoginAttemptLimiter,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_CLIENT,
  MAX_TRACKED_KEYS,
} from './login-attempt-limiter.js';

function limiterAt(now: () => number): LoginAttemptLimiter {
  const limiter = new LoginAttemptLimiter();
  limiter.now = now;
  return limiter;
}

function fail(limiter: LoginAttemptLimiter, ip: string, email: string, times: number): void {
  for (let attempt = 0; attempt < times; attempt += 1) {
    limiter.recordFailure(ip, email);
  }
}

describe('LoginAttemptLimiter', () => {
  it('blocks one client after the per-client failure limit', () => {
    const limiter = limiterAt(() => 0);
    fail(limiter, 'ip1', 'a@b.co', MAX_FAILURES_PER_CLIENT - 1);

    expect(limiter.isBlocked('ip1', 'a@b.co')).toBe(false);
    limiter.recordFailure('ip1', 'a@b.co');
    expect(limiter.isBlocked('ip1', 'a@b.co')).toBe(true);
  });

  it('does not block other clients or other accounts at the per-client limit', () => {
    const limiter = limiterAt(() => 0);
    fail(limiter, 'ip1', 'a@b.co', MAX_FAILURES_PER_CLIENT);

    expect(limiter.isBlocked('ip2', 'a@b.co')).toBe(false);
    expect(limiter.isBlocked('ip1', 'c@d.co')).toBe(false);
  });

  it('blocks an account attacked from many addresses', () => {
    const limiter = limiterAt(() => 0);
    for (let index = 0; index < MAX_FAILURES_PER_ACCOUNT; index += 1) {
      limiter.recordFailure(`2001:db8::${String(index)}`, 'victim@b.co');
    }

    expect(limiter.isBlocked('2001:db8::fresh', 'victim@b.co')).toBe(true);
  });

  it('unblocks when the window has passed', () => {
    let now = 0;
    const limiter = limiterAt(() => now);
    fail(limiter, 'ip', 'a@b.co', MAX_FAILURES_PER_ACCOUNT);

    now = FAILED_LOGIN_WINDOW_MS;

    expect(limiter.isBlocked('ip', 'a@b.co')).toBe(false);
  });

  it('resets both counters after a successful login', () => {
    const limiter = limiterAt(() => 0);
    fail(limiter, 'ip', 'a@b.co', MAX_FAILURES_PER_CLIENT - 1);

    limiter.recordSuccess('ip', 'a@b.co');
    limiter.recordFailure('ip', 'a@b.co');

    expect(limiter.isBlocked('ip', 'a@b.co')).toBe(false);
  });
});

describe('FailureCounter capacity', () => {
  it('keeps memory bounded when many keys are tracked', () => {
    const counter = new FailureCounter(5, () => 0);
    for (let index = 0; index < MAX_TRACKED_KEYS + 50; index += 1) {
      counter.recordFailure(`key-${String(index)}`);
    }

    expect(counter.size).toBe(MAX_TRACKED_KEYS);
  });
});
