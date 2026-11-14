import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { mockHttp } from './test/http-mock';

const SIGN_UP_FLOW_TIMEOUT_MS = 5000;

describe('App', () => {
  it('sends a visitor without a session to the sign-in page', async () => {
    mockHttp([{ method: 'get', url: '/auth/me', status: 401 }]);

    render(<App />);

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('opens the start page right after a successful sign-up', async () => {
    mockHttp([
      { method: 'get', url: '/auth/me', status: 401 },
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
        { name: 'Event Registration Admin' },
        { timeout: SIGN_UP_FLOW_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('shows the admin to a signed-in user', async () => {
    mockHttp([
      {
        method: 'get',
        url: '/auth/me',
        status: 200,
        body: { user: { id: 'u', email: 'a@demo.test', name: 'A', role: 'ADMIN' }, csrfToken: 't' },
      },
    ]);
    window.history.pushState({}, '', '/');

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Event Registration Admin' }),
    ).toBeInTheDocument();
  });
  it.each(['/events', '/sessions', '/registrations', '/users', '/logs', '/tags', '/customers'])(
    'shows "No access" to a customer on %s',
    async (path) => {
      mockHttp([
        {
          method: 'get',
          url: '/auth/me',
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
          url: '/auth/me',
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
