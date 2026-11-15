import { GITHUB_SIGN_IN_ERRORS } from '@ers/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { GITHUB_SIGN_IN_URL, LoginPage } from './login-page';

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

  it('keeps the page title', async () => {
    mockHttp([signedOut, providers(true)]);
    renderLogin();

    expect(await screen.findByText('Event Registration')).toBeInTheDocument();
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
