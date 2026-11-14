import { HttpStatusCode } from 'axios';

import { messageOf, statusOf } from '../api/errors';
import { http, ME_PATH, onSessionRefreshed, setCsrfToken } from '../api/http';

import type { AuthResponse, PublicUser } from '@ers/shared';
import type { AuthProvider } from '@refinedev/core';

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/';

const AUTH_PATHS = {
  login: '/auth/login',
  signup: '/auth/signup',
  logout: '/auth/logout',
} as const;
const SIGN_IN_FAILED = 'Sign-in failed';
const SIGN_UP_FAILED = 'Sign-up failed';
const SIGN_OUT_FAILED = 'Sign-out failed';

/** The signed-in user, cached after login or /auth/me; the cookie is the real source of truth. */
let currentUser: PublicUser | undefined;
/** One /auth/me call shared by everything that asks for the user while it is loading. */
let pendingUser: Promise<PublicUser | undefined> | undefined;

function remember(response: AuthResponse): PublicUser {
  currentUser = response.user;
  setCsrfToken(response.csrfToken);
  return response.user;
}

function forget(): void {
  currentUser = undefined;
  setCsrfToken(undefined);
}

onSessionRefreshed(remember);

async function fetchUser(): Promise<PublicUser | undefined> {
  try {
    return remember((await http.get<AuthResponse>(ME_PATH)).data);
  } catch (error) {
    if (statusOf(error) === HttpStatusCode.Unauthorized) {
      forget();
      return undefined;
    }
    throw error;
  }
}

/** Who is signed in; after a reload the cookie is all the browser has, so this asks the API. */
export async function loadUser(): Promise<PublicUser | undefined> {
  if (currentUser !== undefined) {
    return currentUser;
  }
  pendingUser ??= fetchUser().finally(() => {
    pendingUser = undefined;
  });
  return pendingUser;
}

async function signIn(path: string, body: Record<string, unknown>, failure: string) {
  try {
    remember((await http.post<AuthResponse>(path, body)).data);
    return { success: true, redirectTo: HOME_PATH };
  } catch (error) {
    return { success: false, error: { name: failure, message: messageOf(error, failure) } };
  }
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }: { email: string; password: string }) =>
    signIn(AUTH_PATHS.login, { email, password }, SIGN_IN_FAILED),

  register: async ({ email, password, name }: { email: string; password: string; name: string }) =>
    signIn(AUTH_PATHS.signup, { email, password, name }, SIGN_UP_FAILED),

  /**
   * Only a successful logout signs the tab out. If the request fails the server session still
   * lives, so pretending otherwise would just let the next page load sign the user back in.
   */
  logout: async () => {
    try {
      await http.post(AUTH_PATHS.logout);
    } catch (error) {
      return {
        success: false,
        error: { name: SIGN_OUT_FAILED, message: messageOf(error, SIGN_OUT_FAILED) },
      };
    }
    forget();
    return { success: true, redirectTo: LOGIN_PATH };
  },

  check: async () =>
    (await loadUser()) === undefined
      ? { authenticated: false, logout: true, redirectTo: LOGIN_PATH }
      : { authenticated: true },

  getIdentity: async () => (await loadUser()) ?? null,

  getPermissions: async () => (await loadUser())?.role ?? null,

  onError: (error: unknown) => {
    if (statusOf(error) === HttpStatusCode.Unauthorized) {
      forget();
      return Promise.resolve({ logout: true, redirectTo: LOGIN_PATH });
    }
    return Promise.resolve({});
  },
};
