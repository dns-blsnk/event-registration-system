import type { Role } from './roles.js';

/** Header the admin sends on every state-changing request; value comes from AuthResponse.csrfToken. */
export const CSRF_HEADER = 'x-csrf-token';

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
