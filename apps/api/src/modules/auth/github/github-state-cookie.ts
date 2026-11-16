import { MINUTE_MS } from '../../../common/time.js';
import { clearSessionCookieOptions } from '../../identity/index.js';

import type { Config } from '../../../config/config.schema.js';
import type { CookieOptions } from 'express';

/** Long enough to approve the app on GitHub, short enough that a stale state is useless. */
const STATE_LIFETIME_MINUTES = 10;

/** __Host- in production for the same reason as the session cookie: no subdomain can plant it. */
export function githubStateCookieName(config: Config): string {
  return config.isProduction ? '__Host-github_oauth' : 'github_oauth';
}

/** Same attributes as the session cookie; SameSite=Lax still sends it on the return from GitHub. */
export function githubStateCookieOptions(config: Config): CookieOptions {
  return { ...clearSessionCookieOptions(config), maxAge: STATE_LIFETIME_MINUTES * MINUTE_MS };
}
