import { describe, expect, it } from 'vitest';

import {
  generateCsrfToken,
  generateSessionToken,
  hashSessionToken,
  tokensMatch,
} from './session-tokens.js';

describe('session tokens', () => {
  it('generates 256-bit URL-safe session tokens that never repeat', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateSessionToken));

    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('hashes deterministically to 64 hex characters that differ from the token', () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });

  it('generates 64-character hex CSRF tokens', () => {
    expect(generateCsrfToken()).toMatch(/^[0-9a-f]{64}$/);
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
});

describe('tokensMatch', () => {
  const token = generateCsrfToken();

  it('accepts the exact token', () => {
    expect(tokensMatch(token, token)).toBe(true);
  });

  it.each([
    ['a different token', generateCsrfToken()],
    ['a prefix', token.slice(0, 10)],
    ['an empty string', ''],
    ['no token', undefined],
  ])('rejects %s', (_label, received) => {
    expect(tokensMatch(token, received)).toBe(false);
  });
});
