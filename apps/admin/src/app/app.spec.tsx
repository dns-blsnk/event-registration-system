import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp } from '@/test/http-mock';

import { App } from './app';

const SIGN_UP_FLOW_TIMEOUT_MS = 5000;

describe('App', () => {
  it('sends a visitor without a session to the sign-in page', async () => {
    mockHttp([
      { method: 'get', url: '/auth/session', status: 200, body: { user: null, csrfToken: null } },
    ]);

    render(<App />);

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it(
    'opens the start page right after a successful sign-up',
    async () => {
      mockHttp([
        { method: 'get', url: '/auth/session', status: 200, body: { user: null, csrfToken: null } },
        {
          method: 'post',
          url: '/auth/signup',
          status: 201,
          body: {
            user: { id: 'c', email: 'n@demo.test', name: 'N', role: 'CUSTOMER' },
            csrfToken: 't',
          },
        },
      ]);
      window.history.pushState({}, '', '/register');
      render(<App />);

      await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), 'N');
      await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'n@demo.test');
      await userEvent.type(screen.getByLabelText(/^Password/), 'long-enough-pass');
      await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

      // Sign-up, the session check and two redirects all run here; give a loaded machine time for them.
      expect(
        await screen.findByRole(
          'heading',
          { name: 'Welcome, N' },
          { timeout: SIGN_UP_FLOW_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe('/');
    },
    2 * SIGN_UP_FLOW_TIMEOUT_MS,
  );

  it('signs out to a plain sign-in page, without the address of the page just left', async () => {
    mockHttp([
      {
        method: 'get',
        url: '/auth/session',
        status: 200,
        body: { user: { id: 'u', email: 'a@demo.test', name: 'A', role: 'ADMIN' }, csrfToken: 't' },
      },
      { method: 'get', url: '/tags', status: 200, body: [] },
      { method: 'post', url: '/auth/logout', status: 204 },
      { method: 'get', url: '/auth/session', status: 200, body: { user: null, csrfToken: null } },
      { method: 'get', url: '/auth/providers', status: 200, body: { github: false } },
    ]);
    window.history.pushState({}, '', '/tags');
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Account menu for A' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    // The next person to sign in here must not land on the previous user's page.
    expect(window.location.search).toBe('');
  });

  it('opens on the dashboard for a signed-in user', async () => {
    mockHttp([
      {
        method: 'get',
        url: '/auth/session',
        status: 200,
        body: { user: { id: 'u', email: 'a@demo.test', name: 'A', role: 'ADMIN' }, csrfToken: 't' },
      },
    ]);
    window.history.pushState({}, '', '/');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Welcome, A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pinned events' })).toBeInTheDocument();
  });
  it.each(['/events', '/sessions', '/registrations', '/users', '/logs', '/tags', '/customers'])(
    'shows "No access" to a customer on %s',
    async (path) => {
      mockHttp([
        {
          method: 'get',
          url: '/auth/session',
          status: 200,
          body: {
            user: { id: 'c', email: 'c@demo.test', name: 'C', role: 'CUSTOMER' },
            csrfToken: 't',
          },
        },
      ]);
      window.history.pushState({}, '', path);

      render(<App />);

      expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
    },
  );

  it.each(['/users', '/logs', '/catalog', '/my-registrations'])(
    'shows "No access" to an organizer on %s, which is not for staff',
    async (path) => {
      mockHttp([
        {
          method: 'get',
          url: '/auth/session',
          status: 200,
          body: {
            user: { id: 'o', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' },
            csrfToken: 't',
          },
        },
      ]);
      window.history.pushState({}, '', path);

      render(<App />);

      expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
    },
  );
});
