import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

/** 256-bit random session token for the cookie. Never stored as is. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** What the database stores: a leaked table does not reveal usable session tokens. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 256-bit random CSRF token (64 hex characters). */
export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/** Constant-time comparison, so response timing does not leak how much of a token matched. */
export function tokensMatch(expected: string, received: string | undefined): boolean {
  if (received === undefined) {
    return false;
  }
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
