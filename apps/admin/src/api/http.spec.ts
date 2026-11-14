import { CSRF_HEADER } from '@ers/shared';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';

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
