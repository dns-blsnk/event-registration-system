import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { lazyScreen, RETRY_DELAY_MS } from './signed-in-pages';

function Screen(): React.JSX.Element {
  return <p>Loaded</p>;
}

describe('lazyScreen', () => {
  it('tries a failed download once more, so a network blip does not break the screen', async () => {
    const load = vi
      .fn<() => Promise<typeof Screen>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(Screen);
    const Lazy = lazyScreen(load);

    render(
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>,
    );

    expect(
      await screen.findByText('Loaded', {}, { timeout: 2 * RETRY_DELAY_MS }),
    ).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
