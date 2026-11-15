import {
  API_PREFIX,
  CSRF_HEADER,
  CSRF_SAFE_METHODS,
  ErrorCode,
  type AuthResponse,
} from '@ers/shared';
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { apiErrorOf } from './errors';

/** Same-origin API path: Vite proxies it in development, Vercel rewrites it in production. */
export const API_BASE_URL = `/${API_PREFIX}`;
export const ME_PATH = '/auth/me';

const SAFE_METHODS: ReadonlySet<string> = new Set(CSRF_SAFE_METHODS);

/**
 * The CSRF token comes with login, signup and /auth/me. It is kept in memory only (never in
 * storage), so a page reload asks /auth/me again; the session itself lives in an HttpOnly cookie.
 */
let csrfToken: string | undefined;

export function setCsrfToken(token: string | undefined): void {
  csrfToken = token;
}

export function attachCsrfToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const method = (config.method ?? 'get').toUpperCase();
  if (!SAFE_METHODS.has(method) && csrfToken !== undefined) {
    config.headers.set(CSRF_HEADER, csrfToken);
  }
  return config;
}

/** The one HTTP client of the admin: cookies on, CSRF header on every state-changing request. */
export const http = axios.create({ baseURL: API_BASE_URL, withCredentials: true });
http.interceptors.request.use(attachCsrfToken);

interface RetriableConfig extends InternalAxiosRequestConfig {
  csrfRetried?: boolean;
}

/** Told about every session the client learns of outside a sign-in (the user may have changed). */
let sessionListener: ((session: AuthResponse) => void) | undefined;

export function onSessionRefreshed(listener: (session: AuthResponse) => void): void {
  sessionListener = listener;
}

/** One /auth/me call shared by all requests that hit a stale token at the same time. */
let pendingRefresh: Promise<AuthResponse> | undefined;

async function refreshSession(): Promise<AuthResponse> {
  pendingRefresh ??= http
    .get<AuthResponse>(ME_PATH)
    .then((response) => response.data)
    .finally(() => {
      pendingRefresh = undefined;
    });
  const session = await pendingRefresh;
  setCsrfToken(session.csrfToken);
  sessionListener?.(session);
  return session;
}

/**
 * A token goes stale when the session was renewed in another tab. Fetch the current session from
 * /auth/me (which may belong to someone else now, so listeners update the shown user too) and
 * repeat the request once; a second CSRF_INVALID is a real refusal.
 */
export async function retryWithFreshCsrfToken(error: AxiosError): Promise<unknown> {
  const config = error.config as RetriableConfig | undefined;
  if (
    config === undefined ||
    config.csrfRetried === true ||
    apiErrorOf(error)?.code !== ErrorCode.CSRF_INVALID
  ) {
    throw error;
  }
  config.csrfRetried = true;
  await refreshSession();
  return http.request(config);
}

http.interceptors.response.use(undefined, retryWithFreshCsrfToken);
