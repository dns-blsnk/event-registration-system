import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthGate } from './auth-gate';

interface CheckState {
  isLoading: boolean;
  isFetching: boolean;
  data: unknown;
}

const check = vi.hoisted(() => {
  const state: CheckState = { isLoading: false, isFetching: false, data: undefined };
  return { state };
});

vi.mock('@refinedev/core', () => ({
  useIsAuthenticated: () => check.state,
}));

// The test setup signs out after every test; here only Refine's check decides who is signed in.
vi.mock('@/entities/viewer', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  hasSignedOut: () => false,
}));

const SIGNED_IN = { authenticated: true };
const SIGNED_OUT = { authenticated: false };

function renderGate(keepsFallbackWhileChecking = false): void {
  render(
    <AuthGate
      fallback={<p>Sign-in form</p>}
      keepsFallbackWhileChecking={keepsFallbackWhileChecking}
    >
      <p>Signed-in page</p>
    </AuthGate>,
  );
}

describe('AuthGate', () => {
  afterEach(() => {
    check.state = { isLoading: false, isFetching: false, data: undefined };
  });

  it('shows the session check screen, not a blank page, during the first check', () => {
    check.state = { isLoading: true, isFetching: true, data: undefined };
    renderGate();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Signed-in page')).not.toBeInTheDocument();
  });

  it('waits on the session check screen while a visitor without a session is re-checked', () => {
    check.state = { isLoading: false, isFetching: true, data: SIGNED_OUT };
    renderGate();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Sign-in form')).not.toBeInTheDocument();
  });

  it('keeps the sign-in form while it is re-checked on the sign-in pages', () => {
    check.state = { isLoading: false, isFetching: true, data: SIGNED_OUT };
    renderGate(true);

    expect(screen.getByText('Sign-in form')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps a signed-in page in place during a background re-check', () => {
    check.state = { isLoading: false, isFetching: true, data: SIGNED_IN };
    renderGate();

    expect(screen.getByText('Signed-in page')).toBeInTheDocument();
  });
});
