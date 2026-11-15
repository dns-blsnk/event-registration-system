import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { SignupPage } from './signup-page';

const signedOut: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: null, csrfToken: null },
};

function bodyOf(call: { data?: unknown } | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.data)) as Record<string, unknown>;
}

async function fillIn({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  if (name !== '') await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), name);
  if (email !== '') await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), email);
  if (password !== '') await userEvent.type(screen.getByLabelText(/^Password/), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
}

function renderSignup(): void {
  renderAdminPage({ path: '/register', route: '/register', element: <SignupPage /> });
}

describe('SignupPage', () => {
  it('creates an account with a trimmed name and email', async () => {
    const { calls } = mockHttp([
      signedOut,
      {
        method: 'post',
        url: '/auth/signup',
        status: 201,
        body: {
          user: { id: 'c9', email: 'nina@demo.test', name: 'Nina', role: 'CUSTOMER' },
          csrfToken: 't',
        },
      },
    ]);
    renderSignup();

    await fillIn({ name: ' Nina ', email: ' nina@demo.test ', password: 'long-enough-pass' });

    await waitFor(() => {
      expect(calls.some((call) => call.url === '/auth/signup')).toBe(true);
    });
    expect(bodyOf(calls.find((call) => call.url === '/auth/signup'))).toEqual({
      name: 'Nina',
      email: 'nina@demo.test',
      password: 'long-enough-pass',
    });
  });

  it('shows why the API refused, such as a taken email', async () => {
    mockHttp([
      signedOut,
      {
        method: 'post',
        url: '/auth/signup',
        status: 409,
        body: {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'Email already registered',
          requestId: 'r',
        },
      },
    ]);
    renderSignup();

    await fillIn({ name: 'Nina', email: 'ann@demo.test', password: 'long-enough-pass' });

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });

  it.each([
    [{ name: '', email: 'nina@demo.test', password: 'long-enough-pass' }, 'Required'],
    [
      { name: 'Nina', email: 'nina', password: 'long-enough-pass' },
      'Enter an email address like name@example.com',
    ],
    [
      { name: 'Nina', email: 'nina@demo.test', password: 'short' },
      'Too short: use at least 10 characters',
    ],
    [
      { name: 'Nina', email: 'nina@demo.test', password: 'x'.repeat(129) },
      'Too long: use at most 128 characters',
    ],
  ])('refuses %o before sending', async (values, message) => {
    const { calls } = mockHttp([signedOut]);
    renderSignup();

    await fillIn(values);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/auth/signup')).toBe(false);
  });

  it('marks the field the API refused', async () => {
    mockHttp([
      signedOut,
      {
        method: 'post',
        url: '/auth/signup',
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [{ field: 'email', messages: ['email must be an email'] }],
          requestId: 'r',
        },
      },
    ]);
    renderSignup();

    await fillIn({ name: 'Nina', email: 'a@b.c', password: 'long-enough-pass' });

    expect(await screen.findByText('email must be an email')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps a long pasted password whole instead of cutting it', async () => {
    const { calls } = mockHttp([signedOut]);
    renderSignup();
    const password = 'p'.repeat(128);

    await userEvent.type(screen.getByLabelText(/^Password/), password);

    expect(screen.getByLabelText(/^Password/)).toHaveValue(password);
    expect(calls.some((call) => call.url === '/auth/signup')).toBe(false);
  });

  it('links back to sign in', () => {
    mockHttp([signedOut]);
    renderSignup();

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
