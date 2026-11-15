import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { UserList } from './user-list';

import type { UserListItem } from '@ers/shared';

const me: UserListItem = {
  id: 'a1',
  email: 'admin@demo.test',
  name: 'Ada Admin',
  role: 'ADMIN',
  createdAt: '2026-10-01T09:00:00Z',
};
const ann: UserListItem = {
  id: 'u1',
  email: 'ann@demo.test',
  name: 'Ann Customer',
  role: 'CUSTOMER',
  createdAt: '2026-11-01T09:00:00Z',
};

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: me.id, email: me.email, name: me.name, role: me.role }, csrfToken: 't' },
};
const users: MockRoute = { method: 'get', url: '/users', status: 200, body: [me, ann] };

function bodyOf(call: { data?: unknown } | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.data)) as Record<string, unknown>;
}

function lastQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/users')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

function renderList(): void {
  renderAdminPage({ path: '/users', route: '/users', element: <UserList /> });
}

describe('UserList', () => {
  it('shows users with their role and offers no delete for the signed-in admin', async () => {
    mockHttp([signedIn, users]);
    renderList();

    expect(await screen.findByRole('button', { name: 'Delete Ann Customer' })).toBeInTheDocument();
    expect(screen.getByText('ann@demo.test')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Ada Admin' })).not.toBeInTheDocument();
  });

  it('filters by role and searches on the server', async () => {
    const { calls } = mockHttp([signedIn, users, users, users]);
    renderList();
    await screen.findByText('ann@demo.test');

    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Organizer' }));
    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ role: 'ORGANIZER' });
    });

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'ann{Enter}');
    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ q: 'ann', role: 'ORGANIZER' });
    });
  });

  it('creates a user with email, name, role and password', async () => {
    const { calls } = mockHttp([
      signedIn,
      users,
      { method: 'post', url: '/users', status: 201, body: { ...ann, id: 'u2' } },
      users,
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'olena@demo.test');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Olena');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Role' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Organizer' }));
    await userEvent.type(within(dialog).getByLabelText(/^Password/), 'long-enough-pass');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(bodyOf(calls.find((call) => call.method === 'post'))).toEqual({
      email: 'olena@demo.test',
      name: 'Olena',
      role: 'ORGANIZER',
      password: 'long-enough-pass',
    });
  });

  it('keeps the role label off the select box, so the browser flags no orphan label', async () => {
    mockHttp([signedIn, users]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });

    expect(within(dialog).getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
    expect(within(dialog).getByText('Role', { selector: 'label' })).not.toHaveAttribute('for');
  });

  it('refuses a short password before sending', async () => {
    const { calls } = mockHttp([signedIn, users]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'olena@demo.test');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Olena');
    await userEvent.type(within(dialog).getByLabelText(/^Password/), 'short');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText('Too short: use at least 10 characters'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('refuses an email without a domain before sending', async () => {
    const { calls } = mockHttp([signedIn, users]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'olena');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Olena');
    await userEvent.type(within(dialog).getByLabelText(/^Password/), 'long-enough-pass');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText(/Enter an email address/)).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('reloads the signed-in identity after the admin renames themselves', async () => {
    const { calls } = mockHttp([
      signedIn,
      users,
      { method: 'patch', url: '/users/a1', status: 200, body: { ...me, name: 'Ada Lovelace' } },
      users,
      signedIn,
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Ada Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit user' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Ada Lovelace');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(calls.filter((call) => call.url === '/auth/session')).toHaveLength(2);
    });
    expect(bodyOf(calls.find((call) => call.method === 'patch'))).toEqual({ name: 'Ada Lovelace' });
  });

  it('shows the field error the API returns, such as a taken email', async () => {
    mockHttp([
      signedIn,
      users,
      {
        method: 'post',
        url: '/users',
        status: 409,
        body: {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'Email already registered',
          details: [{ field: 'email', messages: ['Email already registered'] }],
          requestId: 'r',
        },
      },
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add user' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'ann@demo.test');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Ann');
    await userEvent.type(within(dialog).getByLabelText(/^Password/), 'long-enough-pass');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findAllByText('Email already registered')).not.toHaveLength(0);
  });

  it('changes a role and sends only the role', async () => {
    const { calls } = mockHttp([
      signedIn,
      users,
      { method: 'patch', url: '/users/u1', status: 200, body: { ...ann, role: 'ORGANIZER' } },
      users,
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Ann Customer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit user' });
    expect(within(dialog).queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Role' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Organizer' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'patch')).toBe(true);
    });
    expect(bodyOf(calls.find((call) => call.method === 'patch'))).toEqual({ role: 'ORGANIZER' });
  });

  it('does not let the admin change their own role', async () => {
    mockHttp([signedIn, users]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Ada Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit user' });

    expect(within(dialog).getByRole('combobox', { name: 'Role' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(dialog).getByText('You cannot change your own role.')).toBeInTheDocument();
  });

  it('deletes a user only after confirmation', async () => {
    const { calls } = mockHttp([
      signedIn,
      users,
      { method: 'delete', url: '/users/u1', status: 204 },
      { method: 'get', url: '/users', status: 200, body: [me] },
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Ann Customer' }));
    expect(calls.some((call) => call.method === 'delete')).toBe(false);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'delete' && call.url === '/users/u1')).toBe(true);
    });
  });
});
