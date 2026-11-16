import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { CatalogList } from './catalog-list';

import type { CatalogEventListItem } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'c1', email: 'c@demo.test', name: 'C', role: 'CUSTOMER' }, csrfToken: 't' },
};

const listItem: CatalogEventListItem = {
  id: 'e1',
  title: 'Kyiv Frontend Summit',
  city: 'Kyiv',
  venue: 'Main Hall',
  startsAt: '2099-12-01T09:00:00Z',
  endsAt: '2099-12-02T18:00:00Z',
  tags: [{ id: 't1', name: 'Frontend' }],
  upcomingSessionsCount: 2,
  seatsLeft: 12,
};

function lastQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/catalog')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

describe('CatalogList', () => {
  it('lists published events with tags and seats left', async () => {
    mockHttp([signedIn, { method: 'get', url: '/catalog', status: 200, body: [listItem] }]);
    renderAdminPage({ path: '/catalog', route: '/catalog', element: <CatalogList /> });

    expect(await screen.findByText('Kyiv Frontend Summit')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('opens an event from its title', async () => {
    mockHttp([signedIn, { method: 'get', url: '/catalog', status: 200, body: [listItem] }]);
    renderAdminPage({ path: '/catalog', route: '/catalog', element: <CatalogList /> });

    expect(await screen.findByRole('link', { name: 'Kyiv Frontend Summit' })).toHaveAttribute(
      'href',
      '/catalog/e1',
    );
  });

  it.each([
    [{ seatsLeft: 0 }, 'Waitlist only'],
    [{ seatsLeft: 0, upcomingSessionsCount: 0 }, 'Nothing left to book'],
  ])('describes seats %o as "%s"', async (overrides, text) => {
    mockHttp([
      signedIn,
      { method: 'get', url: '/catalog', status: 200, body: [{ ...listItem, ...overrides }] },
    ]);
    renderAdminPage({ path: '/catalog', route: '/catalog', element: <CatalogList /> });

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('filters by city on the server', async () => {
    const list: MockRoute = { method: 'get', url: '/catalog', status: 200, body: [listItem] };
    const { calls } = mockHttp([signedIn, list, list]);
    renderAdminPage({ path: '/catalog', route: '/catalog', element: <CatalogList /> });
    await screen.findByText('Kyiv Frontend Summit');

    await userEvent.type(screen.getByRole('textbox', { name: 'City' }), 'Lviv{Enter}');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ city: 'Lviv' });
    });
  });
});
