import type { Role } from './roles.js';

/** Header the admin sends on every state-changing request; value comes from AuthResponse.csrfToken. */
export const CSRF_HEADER = 'x-csrf-token';

/** Methods that never change state: the server does not check the CSRF token for them, so the client never sends it. */
export const CSRF_SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];

/** Path prefix of every REST route, shared by the API router, the admin client and the dev proxy. */
export const API_PREFIX = 'api';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 120;
export const EMAIL_MAX_LENGTH = 254;

/** User as the API exposes it: never includes the password hash or OAuth ids. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Returned by signup, login and /auth/me. */
export interface AuthResponse {
  user: PublicUser;
  csrfToken: string;
}

/** API paths of the sign-in providers, below the /api prefix. */
export const AUTH_PROVIDER_PATHS = {
  providers: '/auth/providers',
  /** Opened as a page, not called with fetch: the API redirects the browser on to GitHub. */
  github: '/auth/github',
  githubCallback: '/auth/github/callback',
} as const;

/** The admin's sign-in page, where the API sends the browser back after a failed GitHub sign-in. */
export const LOGIN_PAGE_PATH = '/login';

/** What `GET /api/auth/providers` returns: which extra sign-in methods are turned on. */
export interface AuthProviders {
  github: boolean;
}

/** Why a GitHub sign-in did not finish, with the text the sign-in page shows for each reason. */
export const GITHUB_SIGN_IN_ERRORS = {
  failed: 'GitHub sign-in did not finish. Please try again.',
  'no-verified-email':
    'Your GitHub account has no verified primary email, so it cannot be used here.',
  'email-in-use':
    'An account with this email already exists. Sign in with your email and password.',
} as const;

export type GithubSignInError = keyof typeof GITHUB_SIGN_IN_ERRORS;

/** Query parameter that carries a GithubSignInError back to the sign-in page. */
export const GITHUB_SIGN_IN_ERROR_PARAM = 'githubError';

export function isGithubSignInError(value: unknown): value is GithubSignInError {
  return typeof value === 'string' && Object.hasOwn(GITHUB_SIGN_IN_ERRORS, value);
}
