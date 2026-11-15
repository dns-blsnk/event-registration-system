import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { EventList } from './event-list';

import type { EventListItem } from '@ers/shared';

const event: EventListItem = {
  id: 'e1',
  title: 'Kyiv Frontend Summit',
  slug: 'kyiv-frontend-summit',
  city: 'Kyiv',
  venue: 'Main Hall',
  startsAt: '2026-12-01T09:00:00Z',
  endsAt: '2026-12-02T18:00:00Z',
  status: 'PUBLISHED',
  organizer: { id: 'o1', name: 'Olena Organizer' },
  tags: [],
  sessionsCount: 4,
  capacity: 100,
  confirmedCount: 87,
  fillRate: 0.87,
};

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

function eventsRoute(body: EventListItem[] = [event]): MockRoute {
  return { method: 'get', url: '/events', status: 200, body };
}

function lastEventsQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/events')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

describe('EventList', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('shows events with their organizer, seats and status', async () => {
    mockHttp([signedIn, eventsRoute()]);

    renderAdminPage({ path: '/events', route: '/events', element: <EventList /> });

    const row = (await screen.findByText('Kyiv Frontend Summit')).closest('[role="row"]');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText('Olena Organizer')).toBeInTheDocument();
    expect(cells.getByText('87%')).toBeInTheDocument();
    expect(cells.getByText('Published')).toBeInTheDocument();
  });

  it('opens an event from its title as well as from the view button', async () => {
    mockHttp([signedIn, eventsRoute()]);

    renderAdminPage({ path: '/events', route: '/events', element: <EventList /> });

    expect(await screen.findByRole('link', { name: 'Kyiv Frontend Summit' })).toHaveAttribute(
      'href',
      '/events/e1',
    );
  });

  it('asks the server for the first page sorted by start date', async () => {
    const { calls } = mockHttp([signedIn, eventsRoute()]);

    renderAdminPage({ path: '/events', route: '/events', element: <EventList /> });

    await screen.findByText('Kyiv Frontend Summit');
    expect(lastEventsQuery(calls)).toMatchObject({ _start: '0', _sort: 'startsAt', _order: 'asc' });
  });

  it('filters by status on the server', async () => {
    const { calls } = mockHttp([signedIn, eventsRoute(), eventsRoute([])]);
    renderAdminPage({ path: '/events', route: '/events', element: <EventList /> });
    await screen.findByText('Kyiv Frontend Summit');

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cancelled' }));

    await waitFor(() => {
      expect(lastEventsQuery(calls)).toMatchObject({ status: 'CANCELLED' });
    });
  });

  it('goes back to the first page when a filter changes', async () => {
    const { calls } = mockHttp([signedIn, eventsRoute(), eventsRoute([])]);
    renderAdminPage({
      path: '/events?currentPage=3&pageSize=25',
      route: '/events',
      element: <EventList />,
    });
    await screen.findByText('Kyiv Frontend Summit');

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Draft' }));

    await waitFor(() => {
      expect(lastEventsQuery(calls)).toMatchObject({ status: 'DRAFT', _start: '0' });
    });
  });

  it('searches as you type, trimmed, and leaves untouched boxes out', async () => {
    const { calls } = mockHttp([signedIn, eventsRoute(), eventsRoute([])]);
    renderAdminPage({ path: '/events', route: '/events', element: <EventList /> });
    await screen.findByText('Kyiv Frontend Summit');

    await userEvent.type(screen.getByRole('textbox', { name: 'City' }), '  Lviv  ');

    await waitFor(() => {
      expect(lastEventsQuery(calls)).toMatchObject({ city: 'Lviv' });
    });
    expect(lastEventsQuery(calls)).not.toHaveProperty('q');
  });

  it('searches on Enter', async () => {
    const { calls } = mockHttp([signedIn, eventsRoute(), eventsRoute([])]);
    renderAdminPage({ path: '/events', route: '/events', element: <EventList /> });
    await screen.findByText('Kyiv Frontend Summit');

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'summit{Enter}');

    // Sooner than the typing pause would apply it: Enter searches at once.
    await waitFor(
      () => {
        expect(lastEventsQuery(calls)).toMatchObject({ q: 'summit' });
      },
      { timeout: 200 },
    );
  });
});
