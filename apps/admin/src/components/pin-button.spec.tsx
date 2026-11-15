import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../test/http-mock';
import { renderAdminPage } from '../test/render-admin';

import { PinButton } from './pin-button';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

describe('PinButton', () => {
  it('pins an event that is not pinned yet', async () => {
    const { calls } = mockHttp([
      signedIn,
      { method: 'get', url: '/pinned-events', status: 200, body: [] },
      { method: 'put', url: '/pinned-events/e1', status: 204 },
      { method: 'get', url: '/pinned-events', status: 200, body: [] },
    ]);
    renderAdminPage({
      path: '/',
      route: '/',
      element: <PinButton eventId="e1" title="Kyiv Frontend Summit" />,
    });

    const button = await screen.findByRole('button', {
      name: 'Pin Kyiv Frontend Summit to the dashboard',
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'put' && call.url === '/pinned-events/e1')).toBe(
        true,
      );
    });
  });

  it('cannot be used while the pins failed to load, so it never does the opposite', async () => {
    mockHttp([signedIn, { method: 'get', url: '/pinned-events', status: 500, body: {} }]);
    renderAdminPage({
      path: '/',
      route: '/',
      element: <PinButton eventId="e1" title="Kyiv Frontend Summit" />,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kyiv Frontend Summit/ })).toBeDisabled();
    });
    expect(await screen.findByLabelText('Pins could not be loaded')).toBeInTheDocument();
  });
});
