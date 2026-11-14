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
});
