import { ThemedLayout } from '@refinedev/mui';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp } from '../test/http-mock';
import { renderAdminPage } from '../test/render-admin';

import { AppHeader, AppSider } from './app-layout-parts';

describe('admin layout', () => {
  it('signs out only from the user menu, not from the side menu', async () => {
    mockHttp([
      {
        method: 'get',
        url: '/auth/me',
        status: 200,
        body: {
          user: { id: 'a1', email: 'a@demo.test', name: 'Ada', role: 'ADMIN' },
          csrfToken: 't',
        },
      },
    ]);
    renderAdminPage({
      path: '/',
      route: '/',
      element: (
        <ThemedLayout Header={AppHeader} Sider={AppSider}>
          <p>Page</p>
        </ThemedLayout>
      ),
    });
    expect(await screen.findAllByRole('link', { name: 'Events' })).not.toHaveLength(0);
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Ada' }));

    expect(screen.getAllByText('Logout')).toHaveLength(1);
  });
});
