import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminHttpError } from '../providers/data-provider';

import { ErrorBoundary } from './error-boundary';

function Thrower({ error }: { error: unknown }): React.JSX.Element {
  throw error;
}

function Page({ isBroken }: { isBroken: boolean }): React.JSX.Element {
  if (isBroken) throw new Error('page is broken');
  return <p>Page content</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React reports caught render errors on the console; keep test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the page when nothing fails', () => {
    render(
      <ErrorBoundary>
        <Page isBroken={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('shows the request id when the error carries one', () => {
    const error = new AdminHttpError({ message: 'Boom', statusCode: 500, requestId: 'req-42' });
    render(
      <ErrorBoundary>
        <Thrower error={error} />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole('heading', { name: 'Something went wrong on this page' }),
    ).toBeInTheDocument();
    expect(screen.getByText('req-42')).toBeInTheDocument();
  });

  it('shows no request id for a plain render error, and never its message', () => {
    render(
      <ErrorBoundary>
        <Thrower error={new Error('internal detail')} />
      </ErrorBoundary>,
    );

    expect(screen.queryByText(/Request id/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal detail/)).not.toBeInTheDocument();
  });

  it('treats a thrown undefined as a failure too', () => {
    render(
      <ErrorBoundary>
        <Thrower error={undefined} />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole('heading', { name: 'Something went wrong on this page' }),
    ).toBeInTheDocument();
  });

  it('shows the page again once the user moves on', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <Page isBroken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="b">
        <Page isBroken={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('reloads the page when asked', async () => {
    const reload = vi.fn();
    render(
      <ErrorBoundary reload={reload}>
        <Page isBroken />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reload page' }));

    expect(reload).toHaveBeenCalledOnce();
  });
});
