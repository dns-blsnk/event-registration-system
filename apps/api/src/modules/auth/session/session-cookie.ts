import type { Config } from '../../../config/config.schema.js';
import type { CookieOptions, Request } from 'express';

/**
 * In production the __Host- prefix makes the browser enforce Secure, Path=/ and no Domain,
 * so the cookie can never be set or read by another subdomain.
 */
export function sessionCookieName(config: Config): string {
  return config.isProduction ? '__Host-sid' : 'sid';
}

/** HttpOnly (no JS access, not stealable via XSS), SameSite=Lax (not sent on cross-site POSTs). */
export function sessionCookieOptions(config: Config, expires: Date): CookieOptions {
  return { ...clearSessionCookieOptions(config), expires };
}

/** The attributes every auth cookie shares; also what clearing one must repeat. */
export function clearSessionCookieOptions(config: Config): CookieOptions {
  return { httpOnly: true, secure: config.isProduction, sameSite: 'lax', path: '/' };
}

/** The session token from the request cookie, or undefined when absent or empty. */
export function readSessionToken(request: Request, config: Config): string | undefined {
  const token: unknown = request.cookies[sessionCookieName(config)];
  return typeof token === 'string' && token !== '' ? token : undefined;
}
