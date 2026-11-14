import { CSRF_HEADER } from '@ers/shared';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';

import { mockHttp } from '../test/http-mock';

import { API_BASE_URL, attachCsrfToken, http, setCsrfToken } from './http';

function request(method: string): InternalAxiosRequestConfig {
  return { method, headers: new AxiosHeaders() };
}

describe('http client', () => {
  afterEach(() => {
    setCsrfToken(undefined);
  });

  it('talks to the same-origin API with cookies', () => {
    expect(http.defaults.baseURL).toBe(API_BASE_URL);
    expect(http.defaults.withCredentials).toBe(true);
  });

  it.each(['post', 'put', 'patch', 'delete', 'POST'])(
    'adds the CSRF token to %s requests',
    (method) => {
      setCsrfToken('token-1');

      expect(attachCsrfToken(request(method)).headers.get(CSRF_HEADER)).toBe('token-1');
    },
  );

  it.each(['get', 'head', 'options'])('does not send the token with safe %s requests', (method) => {
    setCsrfToken('token-1');

    expect(attachCsrfToken(request(method)).headers.has(CSRF_HEADER)).toBe(false);
  });

  it('runs on every request of the shared client', async () => {
    setCsrfToken('token-2');
    let sent: unknown;

    await http.post(
      '/events',
      {},
      {
        adapter: (config) => {
          sent = config.headers.get(CSRF_HEADER);
          return Promise.resolve({
            data: null,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        },
      },
    );

    expect(sent).toBe('token-2');
  });

  it('sends no header before a token is known', () => {
    expect(attachCsrfToken(request('post')).headers.has(CSRF_HEADER)).toBe(false);
  });
});

describe('stale CSRF token retry', () => {
  const csrfInvalid = {
    statusCode: 403,
    code: 'CSRF_INVALID',
    message: 'Missing or invalid CSRF token',
    requestId: 'r',
  };

  afterEach(() => {
    setCsrfToken(undefined);
  });

  it('fetches a fresh token once and repeats the request with it', async () => {
    setCsrfToken('stale');
    const { calls } = mockHttp([
      { method: 'post', url: '/events', status: 403, body: csrfInvalid },
      { method: 'get', url: '/auth/me', status: 200, body: { user: {}, csrfToken: 'fresh' } },
      { method: 'post', url: '/events', status: 201, body: { ok: true } },
    ]);

    const response = await http.post('/events', {});

    expect(response.status).toBe(201);
    expect(calls.map((call) => call.headers.get(CSRF_HEADER) ?? null)).toEqual([
      'stale',
      null,
      'fresh',
    ]);
  });

  it('gives up after one retry', async () => {
    setCsrfToken('stale');
    mockHttp([
      { method: 'post', url: '/events', status: 403, body: csrfInvalid },
      { method: 'get', url: '/auth/me', status: 200, body: { user: {}, csrfToken: 'fresh' } },
      { method: 'post', url: '/events', status: 403, body: csrfInvalid },
    ]);

    await expect(http.post('/events', {})).rejects.toThrow();
  });

  it('shares one session refresh between requests that fail together', async () => {
    setCsrfToken('stale');
    const { calls } = mockHttp([
      { method: 'post', url: '/a', status: 403, body: csrfInvalid },
      { method: 'post', url: '/b', status: 403, body: csrfInvalid },
      { method: 'get', url: '/auth/me', status: 200, body: { user: {}, csrfToken: 'fresh' } },
      { method: 'post', url: '/a', status: 201 },
      { method: 'post', url: '/b', status: 201 },
    ]);

    await Promise.all([http.post('/a', {}), http.post('/b', {})]);

    expect(calls.filter((call) => call.url === '/auth/me')).toHaveLength(1);
  });

  it('does not retry other refusals', async () => {
    const { calls } = mockHttp([
      { method: 'post', url: '/events', status: 403, body: { ...csrfInvalid, code: 'FORBIDDEN' } },
    ]);

    await expect(http.post('/events', {})).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});
