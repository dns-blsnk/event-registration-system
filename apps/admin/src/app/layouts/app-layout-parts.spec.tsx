import { ThemedLayout } from '@refinedev/mui';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { HelpChatProvider } from '@/features/help-chat';
import { mockHttp } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { AppHeader, AppSider } from './app-layout-parts';

const ADMIN_SESSION = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: {
    user: { id: 'a1', email: 'a@demo.test', name: 'Ada', role: 'ADMIN' },
    csrfToken: 't',
  },
} as const;

function renderLayout(path: string): void {
  renderAdminPage({
    path,
    route: '*',
    element: (
      <HelpChatProvider>
        <ThemedLayout Header={AppHeader} Sider={AppSider}>
          <p>Page</p>
        </ThemedLayout>
      </HelpChatProvider>
    ),
  });
}

describe('admin layout', () => {
  it('links to the dashboard from the side menu and marks it on the dashboard', async () => {
    mockHttp([ADMIN_SESSION]);
    renderLayout('/');

    const links = await screen.findAllByRole('link', { name: 'Dashboard' });

    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark the dashboard entry on another screen', async () => {
    mockHttp([ADMIN_SESSION]);
    renderLayout('/events');

    const links = await screen.findAllByRole('link', { name: 'Dashboard' });

    expect(links[0]).not.toHaveAttribute('aria-current');
  });

  it('signs out only from the user menu, not from the side menu', async () => {
    mockHttp([
      {
        method: 'get',
        url: '/auth/session',
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
        <HelpChatProvider>
          <ThemedLayout Header={AppHeader} Sider={AppSider}>
            <p>Page</p>
          </ThemedLayout>
        </HelpChatProvider>
      ),
    });
    expect(await screen.findAllByRole('link', { name: 'Events' })).not.toHaveLength(0);
    // The help chat opens from the side menu, not from a button floating over the page.
    expect(screen.getAllByRole('button', { name: 'AI assistant' })).not.toHaveLength(0);
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Ada' }));

    expect(screen.getAllByText('Logout')).toHaveLength(1);
  });
});
