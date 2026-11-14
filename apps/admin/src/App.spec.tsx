import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { mockHttp } from './test/http-mock';

describe('App', () => {
  it('sends a visitor without a session to the sign-in page', async () => {
    mockHttp([{ method: 'get', url: '/auth/me', status: 401 }]);

    render(<App />);

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
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
  it.each(['/events', '/sessions', '/registrations', '/users', '/logs'])(
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

  it.each(['/users', '/logs', '/catalog'])(
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
