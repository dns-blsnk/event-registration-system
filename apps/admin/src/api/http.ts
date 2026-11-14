import { API_PREFIX, CSRF_HEADER, CSRF_SAFE_METHODS } from '@ers/shared';
import axios, { type InternalAxiosRequestConfig } from 'axios';

/** Same-origin API path: Vite proxies it in development, Vercel rewrites it in production. */
export const API_BASE_URL = `/${API_PREFIX}`;

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
