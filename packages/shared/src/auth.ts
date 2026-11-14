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
