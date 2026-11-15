import { CSRF_HEADER, type AuthResponse } from '@ers/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { mockHttp } from '../test/http-mock';

import { authProvider, loadUser } from './auth-provider';

const session: AuthResponse = {
  user: { id: 'u1', email: 'admin@demo.test', name: 'Demo Admin', role: 'ADMIN' },
  csrfToken: 'csrf-1',
};

async function signOut(): Promise<void> {
  mockHttp([{ method: 'post', url: '/auth/logout', status: 204 }]);
  await authProvider.logout({});
}

describe('authProvider', () => {
  afterEach(signOut);

  it('signs in, remembers the user and sends the CSRF token afterwards', async () => {
    const { calls } = mockHttp([
      { method: 'post', url: '/auth/login', status: 200, body: session },
      { method: 'post', url: '/events', status: 201 },
    ]);

    expect(
      await authProvider.login({ email: 'admin@demo.test', password: 'secret-password' }),
    ).toEqual({
      success: true,
      redirectTo: '/',
    });
    expect((await loadUser())?.role).toBe('ADMIN');
    expect(await authProvider.getIdentity?.()).toEqual(session.user);
    const { http } = await import('../api/http');
    await http.post('/events', {});
    expect(calls.at(-1)?.headers.get(CSRF_HEADER)).toBe('csrf-1');
  });

  it("shows the API's message when sign-in fails", async () => {
    mockHttp([
      {
        method: 'post',
        url: '/auth/login',
        status: 401,
        body: {
          statusCode: 401,
          code: 'UNAUTHENTICATED',
          message: 'Invalid email or password',
          requestId: 'r',
        },
      },
    ]);

    expect(await authProvider.login({ email: 'x@y.z', password: 'wrong-password' })).toEqual({
      success: false,
      error: { name: 'Sign-in failed', message: 'Invalid email or password' },
    });
    mockHttp([
      { method: 'get', url: '/auth/session', status: 200, body: { user: null, csrfToken: null } },
    ]);
    expect(await loadUser()).toBeUndefined();
  });

  it('restores the session from the cookie after a reload', async () => {
    mockHttp([{ method: 'get', url: '/auth/session', status: 200, body: session }]);

    expect(await authProvider.check({})).toEqual({ authenticated: true });
    expect(await authProvider.getPermissions?.({})).toBe('ADMIN');
  });

  it('sends a visitor without a session to the login page', async () => {
    mockHttp([
      { method: 'get', url: '/auth/session', status: 200, body: { user: null, csrfToken: null } },
    ]);

    expect(await authProvider.check({})).toEqual({
      authenticated: false,
      logout: true,
      redirectTo: '/login',
    });
  });

  it('asks the API only once while the user is known', async () => {
    const { calls } = mockHttp([
      { method: 'get', url: '/auth/session', status: 200, body: session },
    ]);

    await authProvider.check({});
    await authProvider.check({});

    expect(calls).toHaveLength(1);
  });

  it('signs up with a name', async () => {
    const { calls } = mockHttp([
      { method: 'post', url: '/auth/signup', status: 201, body: session },
    ]);

    expect(
      await authProvider.register?.({ email: 'n@e.w', password: 'long-password', name: 'New' }),
    ).toEqual({
      success: true,
      redirectTo: '/',
    });
    expect(JSON.parse(String(calls[0]?.data))).toEqual({
      email: 'n@e.w',
      password: 'long-password',
      name: 'New',
    });
  });

  it('forgets the user and goes to login when the API answers 401', async () => {
    mockHttp([{ method: 'get', url: '/auth/session', status: 200, body: session }]);
    await authProvider.check({});

    const result = await authProvider.onError({ response: { status: 401 }, isAxiosError: true });

    expect(result).toEqual({ logout: true, redirectTo: '/login' });
    const { calls } = mockHttp([
      { method: 'get', url: '/auth/session', status: 200, body: { user: null, csrfToken: null } },
    ]);
    expect(await loadUser()).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it('leaves other errors to the page', async () => {
    expect(await authProvider.onError({ response: { status: 409 }, isAxiosError: true })).toEqual(
      {},
    );
  });

  it('stays signed in and reports the failure when logout does not reach the server', async () => {
    mockHttp([{ method: 'get', url: '/auth/session', status: 200, body: session }]);
    await authProvider.check({});
    mockHttp([
      {
        method: 'post',
        url: '/auth/logout',
        status: 503,
        body: {
          statusCode: 503,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database unavailable',
          requestId: 'r',
        },
      },
    ]);

    expect(await authProvider.logout({})).toEqual({
      success: false,
      error: { name: 'Sign-out failed', message: 'Database unavailable' },
    });
    expect((await loadUser())?.id).toBe('u1');
  });

  it('asks the API once when several parts of the page need the user at the same time', async () => {
    const { calls } = mockHttp([
      { method: 'get', url: '/auth/session', status: 200, body: session },
    ]);

    await Promise.all([
      authProvider.check({}),
      authProvider.getIdentity?.(),
      authProvider.getPermissions?.({}),
    ]);

    expect(calls).toHaveLength(1);
  });

  it('follows the user when a stale-token refresh reveals a different session', async () => {
    mockHttp([{ method: 'get', url: '/auth/session', status: 200, body: session }]);
    await authProvider.check({});
    const organizer: AuthResponse = {
      user: { ...session.user, id: 'u2', role: 'ORGANIZER' },
      csrfToken: 'csrf-2',
    };
    mockHttp([
      {
        method: 'post',
        url: '/events',
        status: 403,
        body: { statusCode: 403, code: 'CSRF_INVALID', message: 'x', requestId: 'r' },
      },
      { method: 'get', url: '/auth/me', status: 200, body: organizer },
      { method: 'post', url: '/events', status: 201 },
    ]);
    const { http } = await import('../api/http');

    await http.post('/events', {});

    expect(await authProvider.getPermissions?.({})).toBe('ORGANIZER');
  });
});
