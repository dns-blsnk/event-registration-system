import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../test/http-mock';
import { renderAdminPage } from '../test/render-admin';

import { initialsOf, UserMenu } from './user-menu';

import type { Role } from '@ers/shared';

function signedInAs(role: Role): MockRoute {
  return {
    method: 'get',
    url: '/auth/session',
    status: 200,
    body: {
      user: { id: 'u1', email: 'ada@demo.test', name: 'Ada Lovelace', role },
      csrfToken: 't',
    },
  };
}

async function openMenu(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Account menu for Ada Lovelace' }),
  );
}

describe('UserMenu', () => {
  it('shows who is signed in, with their email and role', async () => {
    mockHttp([signedInAs('ORGANIZER')]);
    renderAdminPage({ path: '/', route: '/', element: <UserMenu /> });

    await openMenu();

    expect(screen.getByText('ada@demo.test')).toBeInTheDocument();
    expect(screen.getByText('Organizer')).toBeInTheDocument();
  });

  it('opens with focus on the first action, not on the account details', async () => {
    mockHttp([signedInAs('ADMIN')]);
    renderAdminPage({ path: '/', route: '/', element: <UserMenu /> });

    await openMenu();

    expect(screen.getByRole('menuitem', { name: 'Logout' })).toHaveFocus();
  });

  it('still offers sign-out when the user cannot be loaded', async () => {
    mockHttp([{ method: 'get', url: '/auth/session', status: 500, body: { message: 'Down' } }]);
    renderAdminPage({ path: '/', route: '/', element: <UserMenu /> });

    expect(await screen.findByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it('signs out from the menu', async () => {
    const { calls } = mockHttp([
      signedInAs('ADMIN'),
      { method: 'post', url: '/auth/logout', status: 204 },
    ]);
    renderAdminPage({ path: '/', route: '/', element: <UserMenu /> });

    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'post' && call.url === '/auth/logout')).toBe(
        true,
      );
    });
  });
});

describe('initialsOf', () => {
  it('takes the first letters of up to two words', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('ada')).toBe('A');
    expect(initialsOf('Mary Ann Smith')).toBe('MA');
  });

  it('keeps an emoji whole and never leaves the avatar empty', () => {
    expect(initialsOf('😀 Ann')).toBe('😀A');
    expect(initialsOf('   ')).toBe('?');
  });
});
