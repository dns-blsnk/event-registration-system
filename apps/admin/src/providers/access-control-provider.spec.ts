import { afterEach, describe, expect, it } from 'vitest';

import { mockHttp } from '../test/http-mock';

import { accessControlProvider } from './access-control-provider';
import { authProvider } from './auth-provider';

import type { Role } from '@ers/shared';

async function signInAs(role: Role): Promise<void> {
  mockHttp([
    {
      method: 'get',
      url: '/auth/me',
      status: 200,
      body: { user: { id: 'u', email: 'u@demo.test', name: 'U', role }, csrfToken: 't' },
    },
  ]);
  await authProvider.check({});
}

async function allowed(resource: string | undefined, action: string): Promise<boolean> {
  return (
    await accessControlProvider.can(resource === undefined ? { action } : { resource, action })
  ).can;
}

describe('accessControlProvider', () => {
  afterEach(async () => {
    mockHttp([{ method: 'post', url: '/auth/logout', status: 204 }]);
    await authProvider.logout({});
  });

  it('allows nothing before sign-in', async () => {
    mockHttp([{ method: 'get', url: '/auth/me', status: 401 }]);

    expect(await allowed('events', 'list')).toBe(false);
  });

  it('follows the shared permission matrix for each role', async () => {
    await signInAs('ORGANIZER');

    expect(await allowed('events', 'list')).toBe(true);
    expect(await allowed('users', 'list')).toBe(false);
    expect(await allowed('tags', 'create')).toBe(false);
  });

  it('lets an admin manage users and read logs', async () => {
    await signInAs('ADMIN');

    expect(await allowed('users', 'delete')).toBe(true);
    expect(await allowed('app-logs', 'list')).toBe(true);
  });

  it('keeps customers to their own pages', async () => {
    await signInAs('CUSTOMER');

    expect(await allowed('my-registrations', 'create')).toBe(true);
    expect(await allowed('registrations', 'list')).toBe(false);
  });

  it.each([
    [undefined, 'list'],
    ['dashboard', 'list'],
    ['events', 'launch'],
  ])('denies unknown resource %s or action %s', async (resource, action) => {
    await signInAs('ADMIN');

    expect(await allowed(resource, action)).toBe(false);
  });
});
