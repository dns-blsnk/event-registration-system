import { SESSION_PATH } from '@ers/shared';
import { HttpStatusCode } from 'axios';

import {
  apiErrorOf,
  messageOf,
  statusOf,
  http,
  onSessionRefreshed,
  setCsrfToken,
} from '@/shared/api';
import { HOME_PATH, LOGIN_PATH } from '@/shared/config';

import type { AuthResponse, PublicUser, SessionResponse } from '@ers/shared';
import type { AuthProvider } from '@refinedev/core';

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

/** True from sign-out (or a 401) until the next sign-in; the signed-in area hides at once. */
let isSignedOut = false;
const signOutListeners = new Set<() => void>();

function setSignedOut(value: boolean): void {
  if (isSignedOut === value) return;
  isSignedOut = value;
  signOutListeners.forEach((listener) => {
    listener();
  });
}

/** For useSyncExternalStore: lets the auth gate react to sign-out without waiting for a re-check. */
export function subscribeToSignOut(listener: () => void): () => void {
  signOutListeners.add(listener);
  return () => {
    signOutListeners.delete(listener);
  };
}

export function hasSignedOut(): boolean {
  return isSignedOut;
}

/**
 * True after the user signed out themselves (not an expired session), until the next sign-in.
 * The sign-in page then gets no "return to" address: the next person to sign in in this tab
 * starts on their own dashboard, not on the previous user's page.
 */
let hasChosenToLeave = false;

export function hasSignedOutByChoice(): boolean {
  return hasChosenToLeave;
}

function remember(response: AuthResponse): PublicUser {
  hasChosenToLeave = false;
  currentUser = response.user;
  setCsrfToken(response.csrfToken);
  setSignedOut(false);
  return response.user;
}

function forget(): void {
  currentUser = undefined;
  setCsrfToken(undefined);
  setSignedOut(true);
}

onSessionRefreshed(remember);

/**
 * Asks the always-200 session check, so a visitor without a session causes no failed request
 * (and no console error) before signing in; who is signed in is known only to the server.
 */
async function fetchUser(): Promise<PublicUser | undefined> {
  try {
    const session = (await http.get<SessionResponse>(SESSION_PATH)).data;
    if (session.user === null) {
      forget();
      return undefined;
    }
    return remember(session);
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

/** Drops the cached user (not the session), so the next loadUser asks the session check again. */
export function forgetCachedUser(): void {
  currentUser = undefined;
}

async function signIn(path: string, body: Record<string, unknown>, failure: string) {
  try {
    remember((await http.post<AuthResponse>(path, body)).data);
    return { success: true, redirectTo: HOME_PATH };
  } catch (error) {
    // Field details go along, so a form can mark the field the API refused.
    const details = apiErrorOf(error)?.details;
    return {
      success: false,
      error: {
        name: failure,
        message: messageOf(error, failure),
        ...(details === undefined ? {} : { details }),
      },
    };
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
    // Set before the signed-in area learns of the sign-out, so it reads the right reason.
    hasChosenToLeave = true;
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
