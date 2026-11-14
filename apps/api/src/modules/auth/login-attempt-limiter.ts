import { Injectable } from '@nestjs/common';

import { MINUTE_MS } from '../../common/time.js';

const FAILED_LOGIN_WINDOW_MINUTES = 15;
export const FAILED_LOGIN_WINDOW_MS = FAILED_LOGIN_WINDOW_MINUTES * MINUTE_MS;
/** Bounds memory if an attacker cycles through many emails. */
export const MAX_TRACKED_KEYS = 10_000;

interface Attempts {
  failures: number;
  windowStart: number;
}

/**
 * Fixed-window failure counter per key. After `maxFailures` in the window the key is blocked until
 * the window ends. In memory: correct for a single instance (see README for scaling).
 */
export class FailureCounter {
  private readonly attempts = new Map<string, Attempts>();
  private lastSweep = 0;

  constructor(
    private readonly maxFailures: number,
    private readonly now: () => number,
  ) {}

  get size(): number {
    return this.attempts.size;
  }

  isBlocked(key: string): boolean {
    const entry = this.current(key);
    return entry !== undefined && entry.failures >= this.maxFailures;
  }

  recordFailure(key: string): void {
    const entry = this.current(key) ?? { failures: 0, windowStart: this.now() };
    entry.failures += 1;
    this.attempts.set(key, entry);
    this.enforceCapacity();
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private current(key: string): Attempts | undefined {
    const entry = this.attempts.get(key);
    if (entry !== undefined && this.now() - entry.windowStart >= FAILED_LOGIN_WINDOW_MS) {
      this.attempts.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Sweeps expired entries at most once a minute; if still over capacity, drops the oldest. */
  private enforceCapacity(): void {
    if (this.attempts.size <= MAX_TRACKED_KEYS) {
      return;
    }
    if (this.now() - this.lastSweep >= MINUTE_MS) {
      this.lastSweep = this.now();
      for (const key of [...this.attempts.keys()]) {
        this.current(key);
      }
    }
    while (this.attempts.size > MAX_TRACKED_KEYS) {
      const oldest = this.attempts.keys().next();
      if (oldest.done === true) {
        return;
      }
      this.attempts.delete(oldest.value);
    }
  }
}

/** Failures allowed per client IP and email: stops guessing one account from one place. */
export const MAX_FAILURES_PER_CLIENT = 5;
/**
 * Failures allowed per email from anywhere: stops attackers who rotate addresses (an IPv6 /64,
 * a botnet). Higher than the per-client limit so one client cannot easily lock others out.
 */
export const MAX_FAILURES_PER_ACCOUNT = 20;

/** Brute-force protection for login, by (client IP, email) and by email alone. */
@Injectable()
export class LoginAttemptLimiter {
  /** Clock, replaceable in tests. */
  now: () => number = Date.now;
  private readonly perClient = new FailureCounter(MAX_FAILURES_PER_CLIENT, () => this.now());
  private readonly perAccount = new FailureCounter(MAX_FAILURES_PER_ACCOUNT, () => this.now());

  isBlocked(clientIp: string, email: string): boolean {
    return this.perClient.isBlocked(`${clientIp}:${email}`) || this.perAccount.isBlocked(email);
  }

  recordFailure(clientIp: string, email: string): void {
    this.perClient.recordFailure(`${clientIp}:${email}`);
    this.perAccount.recordFailure(email);
  }

  recordSuccess(clientIp: string, email: string): void {
    this.perClient.reset(`${clientIp}:${email}`);
    this.perAccount.reset(email);
  }
}
