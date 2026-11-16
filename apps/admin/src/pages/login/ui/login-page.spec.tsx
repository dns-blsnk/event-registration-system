import { GITHUB_SIGN_IN_ERRORS } from '@ers/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GITHUB_SIGN_IN_URL } from '@/features/github-sign-in';
import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { LoginPage } from './login-page';

const signedOut: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: null, csrfToken: null },
};

function providers(github: boolean): MockRoute {
  return { method: 'get', url: '/auth/providers', status: 200, body: { github } };
}

function renderLogin(path = '/login'): void {
  renderAdminPage({ path, route: '/login', element: <LoginPage /> });
}

describe('LoginPage', () => {
  it('offers GitHub sign-in as a link to the API when GitHub is enabled', async () => {
    mockHttp([signedOut, providers(true)]);
    renderLogin();

    const link = await screen.findByRole('link', { name: 'Sign in with GitHub' });

    expect(link).toHaveAttribute('href', GITHUB_SIGN_IN_URL);
    expect(GITHUB_SIGN_IN_URL).toBe('/api/auth/github');
  });

  it('names the product and the page', async () => {
    mockHttp([signedOut, providers(true)]);
    renderLogin();

    expect(await screen.findByText('Event Registration System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('refuses an empty form before sending', async () => {
    const { calls } = mockHttp([signedOut, providers(false)]);
    renderLogin();

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findAllByText('Required')).toHaveLength(2);
    expect(calls.some((call) => call.url === '/auth/login')).toBe(false);
  });

  it('signs in with a trimmed email', async () => {
    const { calls } = mockHttp([
      signedOut,
      providers(false),
      {
        method: 'post',
        url: '/auth/login',
        status: 200,
        body: {
          user: { id: 'u', email: 'ann@demo.test', name: 'Ann', role: 'ADMIN' },
          csrfToken: 't',
        },
      },
    ]);
    renderLogin();

    await userEvent.type(await screen.findByRole('textbox', { name: 'Email' }), ' ann@demo.test ');
    await userEvent.type(screen.getByLabelText(/^Password/), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(calls.some((call) => call.url === '/auth/login')).toBe(true);
    });
    expect(JSON.parse(String(calls.find((call) => call.url === '/auth/login')?.data))).toEqual({
      email: 'ann@demo.test',
      password: 'secret-pass',
    });
  });

  it('shows the typed password on request', async () => {
    mockHttp([signedOut, providers(false)]);
    renderLogin();
    const password = await screen.findByLabelText(/^Password/);

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('hides the GitHub button without an error message when the API cannot say', async () => {
    mockHttp([
      signedOut,
      { method: 'get', url: '/auth/providers', status: 503, body: { message: 'Down' } },
    ]);
    renderLogin();

    await screen.findByRole('button', { name: 'Sign in' });

    expect(screen.queryByRole('link', { name: 'Sign in with GitHub' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Down|status code/i)).not.toBeInTheDocument();
  });

  it('removes the GitHub error when it is dismissed', async () => {
    mockHttp([signedOut, providers(true)]);
    renderLogin('/login?githubError=failed');

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows no GitHub button when GitHub is not enabled', async () => {
    mockHttp([signedOut, providers(false)]);
    renderLogin();

    await screen.findByRole('button', { name: 'Sign in' });

    expect(screen.queryByRole('link', { name: 'Sign in with GitHub' })).not.toBeInTheDocument();
  });

  it('explains why the last GitHub sign-in failed', async () => {
    mockHttp([signedOut, providers(true)]);
    renderLogin('/login?githubError=email-in-use');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      GITHUB_SIGN_IN_ERRORS['email-in-use'],
    );
  });

  it('shows nothing for an unknown error value in the URL', async () => {
    mockHttp([signedOut, providers(true)]);
    renderLogin('/login?githubError=%3Cb%3Ehello%3C%2Fb%3E');

    await screen.findByRole('button', { name: 'Sign in' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/hello/)).not.toBeInTheDocument();
  });
});
