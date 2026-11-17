import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionCheckScreen, SLOW_CHECK_MS } from './session-check-screen';

const WAKING_UP = /Waking up the server/;

describe('SessionCheckScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a spinner instead of a blank page while the session is checked', () => {
    render(<SessionCheckScreen />);

    expect(screen.getByRole('progressbar', { name: 'Checking your session' })).toBeInTheDocument();
    expect(screen.queryByText(WAKING_UP)).not.toBeInTheDocument();
  });

  it('explains the wait once the check takes long enough to be a sleeping server', () => {
    render(<SessionCheckScreen />);

    act(() => {
      vi.advanceTimersByTime(SLOW_CHECK_MS);
    });

    expect(screen.getByText(WAKING_UP)).toBeInTheDocument();
  });
});
