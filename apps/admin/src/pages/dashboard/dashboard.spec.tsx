import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { DashboardPage } from './dashboard-page';

import type { EventListItem, Role } from '@ers/shared';

const pinned: EventListItem = {
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
  confirmedCount: 92,
  fillRate: 0.92,
};

const IN_A_WEEK = new Date(Date.now() + 7 * 86_400_000).toISOString();

function signedInAs(role: Role): MockRoute {
  return {
    method: 'get',
    url: '/auth/me',
    status: 200,
    body: { user: { id: 'u1', email: 'u@demo.test', name: 'Una', role }, csrfToken: 't' },
  };
}

function list(url: string, body: unknown[] = []): MockRoute {
  return { method: 'get', url, status: 200, body };
}

/** Everything the staff dashboard asks for: two event counts, a session count, pins, logs. */
function staffRoutes(role: Role, pins: EventListItem[] = []): MockRoute[] {
  return [
    signedInAs(role),
    list('/events', [pinned, pinned]),
    list('/events', [pinned]),
    list('/sessions', [{ id: 's1' }]),
    list('/pinned-events', pins),
    list('/app-logs', [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }]),
  ];
}

function renderDashboard(): void {
  renderAdminPage({ path: '/', route: '/', element: <DashboardPage /> });
}

describe('DashboardPage', () => {
  it('greets the user and shows staff counts that open their lists', async () => {
    mockHttp(staffRoutes('ORGANIZER'));
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Welcome, Una' })).toBeInTheDocument();
    const almostFull = await screen.findByRole('link', { name: /Almost full sessions/ });
    expect(almostFull.getAttribute('href')).toContain('/sessions?');
    expect(decodeURIComponent(almostFull.getAttribute('href') ?? '')).toContain(
      'filters[0][field]=almostFull',
    );
  });

  it('shows the error count to admins only', async () => {
    mockHttp(staffRoutes('ADMIN'));
    renderDashboard();

    expect(await screen.findByRole('link', { name: /Errors, last 7 days/ })).toBeInTheDocument();
  });

  it('keeps the error count from organizers', async () => {
    mockHttp(staffRoutes('ORGANIZER'));
    renderDashboard();
    await screen.findByRole('link', { name: /Published events/ });

    expect(screen.queryByRole('link', { name: /Errors, last 7 days/ })).not.toBeInTheDocument();
  });

  it('explains how to pin when nothing is pinned', async () => {
    mockHttp(staffRoutes('ORGANIZER'));
    renderDashboard();

    expect(await screen.findByText(/Pin events from the events list/)).toBeInTheDocument();
  });

  it('shows pinned events with their status and a red bar when almost full', async () => {
    mockHttp(staffRoutes('ORGANIZER', [pinned]));
    renderDashboard();

    expect(await screen.findByRole('link', { name: 'Kyiv Frontend Summit' })).toHaveAttribute(
      'href',
      '/events/e1',
    );
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Filled' })).toHaveAttribute(
      'aria-valuetext',
      '92%',
    );
  });

  it('unpins an event from its card', async () => {
    const { calls } = mockHttp([
      ...staffRoutes('ORGANIZER', [pinned]),
      // The card's own pin button reads the pins again when it mounts.
      list('/pinned-events', [pinned]),
      { method: 'delete', url: '/pinned-events/e1', status: 204 },
      list('/pinned-events', []),
    ]);
    renderDashboard();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Unpin Kyiv Frontend Summit from the dashboard' }),
    );

    await waitFor(() => {
      expect(
        calls.some((call) => call.method === 'delete' && call.url === '/pinned-events/e1'),
      ).toBe(true);
    });
    expect(await screen.findByText(/Pin events from the events list/)).toBeInTheDocument();
  });

  it('shows a customer their upcoming bookings and what is coming up, without staff counts', async () => {
    mockHttp([
      signedInAs('CUSTOMER'),
      list('/my-registrations', [
        {
          id: 'r1',
          status: 'CONFIRMED',
          createdAt: '2026-11-01T09:00:00Z',
          cancelledAt: null,
          waitlistPosition: null,
          session: {
            id: 's1',
            title: 'State of React',
            startsAt: IN_A_WEEK,
            endsAt: IN_A_WEEK,
            room: null,
          },
          event: { id: 'e1', title: 'Kyiv Frontend Summit', city: 'Kyiv', venue: 'Main Hall' },
        },
      ]),
      list('/catalog', [{ ...pinned, upcomingSessionsCount: 2, seatsLeft: 8 }]),
    ]);
    renderDashboard();

    expect(await screen.findByText('State of React')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Kyiv Frontend Summit' })).toHaveAttribute(
      'href',
      '/catalog/e1',
    );
    expect(screen.queryByRole('heading', { name: 'Pinned events' })).not.toBeInTheDocument();
  });
});
