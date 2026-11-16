import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ASSISTANT_LIST_STATE, useAssistantPageKey } from './use-assistant-page-key';

function Page(): React.JSX.Element {
  return <output aria-label="page key">{useAssistantPageKey()}</output>;
}

function renderRouter() {
  const router = createMemoryRouter([{ path: '*', element: <Page /> }], {
    initialEntries: ['/events'],
  });
  render(<RouterProvider router={router} />);
  return {
    go: async (to: string | number, opening?: string) => {
      await act(async () => {
        await (typeof to === 'number'
          ? router.navigate(to)
          : router.navigate(
              to,
              opening === undefined ? {} : { state: { [ASSISTANT_LIST_STATE]: opening } },
            ));
      });
    },
  };
}

describe('useAssistantPageKey', () => {
  it('changes once for each list the assistant opens, and not for other navigation', async () => {
    const { go } = renderRouter();

    await go('/events?a', 'first');
    expect(screen.getByLabelText('page key')).toHaveTextContent('1');
    await go('/events?b');
    expect(screen.getByLabelText('page key')).toHaveTextContent('1');
    await go('/events?c', 'second');

    expect(screen.getByLabelText('page key')).toHaveTextContent('2');
  });

  it('changes again on Back to a list the assistant opened, so it reads that list’s filters', async () => {
    const { go } = renderRouter();
    await go('/events?a', 'first');
    await go('/events?c', 'second');

    await go(-1);

    expect(screen.getByLabelText('page key')).toHaveTextContent('3');
  });
});
