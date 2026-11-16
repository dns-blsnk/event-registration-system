import { describe, expect, it } from 'vitest';

import { TEST_ENV } from '../../../../test/helpers/test-env.js';
import { parseConfig } from '../../../config/config.schema.js';

import {
  clearSessionCookieOptions,
  sessionCookieName,
  sessionCookieOptions,
} from './session-cookie.js';

const production = parseConfig({ ...TEST_ENV, NODE_ENV: 'production', TRUST_PROXY_HOPS: '1' });
const development = parseConfig({ ...TEST_ENV, NODE_ENV: 'development' });
const expires = new Date('2026-11-21T00:00:00Z');

describe('session cookie', () => {
  it('uses the __Host- prefix in production so the browser enforces Secure and Path=/', () => {
    expect(sessionCookieName(production)).toBe('__Host-sid');
    expect(sessionCookieOptions(production, expires)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires,
    });
  });

  it('works over plain http in development', () => {
    expect(sessionCookieName(development)).toBe('sid');
    expect(sessionCookieOptions(development, expires).secure).toBe(false);
  });

  it('clears with the same attributes it was set with', () => {
    expect({ ...clearSessionCookieOptions(production), expires }).toEqual(
      sessionCookieOptions(production, expires),
    );
  });
});
