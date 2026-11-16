import { createHash, randomBytes } from 'node:crypto';

import { tokensMatch } from '../session/session-tokens.js';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const RANDOM_BYTES = 32;
/** Read the profile and the verified primary email; nothing else. */
const SCOPES = 'read:user user:email';
/** Separates state and verifier in the cookie; neither contains it (both are base64url). */
const COOKIE_SEPARATOR = '.';

/** A started GitHub sign-in: where to send the browser, and what to remember until it returns. */
export interface GithubAuthorization {
  url: string;
  /** Kept in a short-lived HttpOnly cookie and checked on return. */
  cookieValue: string;
}

function random(): string {
  return randomBytes(RANDOM_BYTES).toString('base64url');
}

/**
 * Starts the authorization code flow. `state` ties the return to this browser (no login CSRF);
 * the PKCE verifier makes a stolen code useless without the cookie.
 */
export function startGithubAuthorization(
  clientId: string,
  redirectUri: string,
): GithubAuthorization {
  const state = random();
  const verifier = random();
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    allow_signup: 'true',
  }).toString();
  return { url: url.toString(), cookieValue: `${state}${COOKIE_SEPARATOR}${verifier}` };
}

/** The PKCE verifier if the returned state matches the one this browser started with. */
export function verifyGithubReturn(
  cookieValue: unknown,
  returnedState: unknown,
): string | undefined {
  if (typeof cookieValue !== 'string' || typeof returnedState !== 'string') return undefined;
  const [state, verifier, extra] = cookieValue.split(COOKIE_SEPARATOR);
  if (state === undefined || verifier === undefined || extra !== undefined) return undefined;
  return tokensMatch(state, returnedState) ? verifier : undefined;
}
