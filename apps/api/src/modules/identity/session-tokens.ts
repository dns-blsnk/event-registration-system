import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

/** 256-bit random bearer token (session cookie, chat ticket). Never stored as is. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** What the server keeps of a bearer token: a leaked store does not reveal usable tokens. */
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
