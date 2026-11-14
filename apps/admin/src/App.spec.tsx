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
  it('shows "No access" to a role that may not open a page', async () => {
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
    window.history.pushState({}, '', '/events');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
  });
});
