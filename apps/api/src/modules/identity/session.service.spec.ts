import { describe, expect, it } from 'vitest';

import { isExpired, SESSION_IDLE_TIMEOUT_MS } from './session.service.js';

const NOW = new Date('2026-11-14T12:00:00Z');

function session(expiresInMs: number, idleForMs: number): { expiresAt: Date; lastSeenAt: Date } {
  return {
    expiresAt: new Date(NOW.getTime() + expiresInMs),
    lastSeenAt: new Date(NOW.getTime() - idleForMs),
  };
}

describe('isExpired', () => {
  it('keeps a fresh session', () => {
    expect(isExpired(session(60_000, 0), NOW)).toBe(false);
  });

  it('expires at the absolute lifetime', () => {
    expect(isExpired(session(0, 0), NOW)).toBe(true);
  });

  it('expires after the idle timeout', () => {
    expect(isExpired(session(60_000, SESSION_IDLE_TIMEOUT_MS), NOW)).toBe(true);
  });

  it('keeps a session idle for just under the timeout', () => {
    expect(isExpired(session(60_000, SESSION_IDLE_TIMEOUT_MS - 1), NOW)).toBe(false);
  });
});
