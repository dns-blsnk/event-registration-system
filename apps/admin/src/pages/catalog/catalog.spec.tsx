import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { CatalogList } from './catalog-list';
import { CatalogShow } from './catalog-show';

import type {
  CatalogEventDetail,
  CatalogEventListItem,
  CatalogSession,
  MyRegistration,
} from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/me',
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

function session(overrides: Partial<CatalogSession>): CatalogSession {
  return {
    id: 's1',
    title: 'State of React',
    speaker: 'Ann Speaker',
    room: 'Room A',
    startsAt: '2099-12-01T09:00:00Z',
    endsAt: '2099-12-01T10:00:00Z',
    capacity: 50,
    seatsLeft: 12,
    isUpcoming: true,
    myRegistration: null,
    ...overrides,
  };
}

function detail(sessions: CatalogSession[]): CatalogEventDetail {
  return {
    ...listItem,
    description: 'Two days of talks.',
    bannerUrl: null,
    organizerName: 'Olena',
    sessions,
  };
}

function lastQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/catalog')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

function showEvent(sessions: CatalogSession[], extra: MockRoute[] = []) {
  const mock = mockHttp([
    signedIn,
    { method: 'get', url: '/catalog/e1', status: 200, body: detail(sessions) },
    ...extra,
  ]);
  renderAdminPage({ path: '/catalog/e1', route: '/catalog/:id', element: <CatalogShow /> });
  return mock;
}

describe('CatalogList', () => {
  it('lists published events with tags and seats left', async () => {
    mockHttp([signedIn, { method: 'get', url: '/catalog', status: 200, body: [listItem] }]);
    renderAdminPage({ path: '/catalog', route: '/catalog', element: <CatalogList /> });

    expect(await screen.findByText('Kyiv Frontend Summit')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
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

describe('CatalogShow', () => {
  it('shows the event and its sessions with seats', async () => {
    showEvent([session({})]);

    expect(
      await screen.findByRole('heading', { name: 'Kyiv Frontend Summit' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Two days of talks.')).toBeInTheDocument();
    expect(screen.getByText('Seats left: 12 of 50')).toBeInTheDocument();
    expect(screen.getByText(/–/)).toBeInTheDocument();
  });

  it('books a seat and tells the customer it is booked', async () => {
    const booked: MyRegistration = {
      id: 'r1',
      status: 'CONFIRMED',
      createdAt: '2026-11-14T10:00:00Z',
      cancelledAt: null,
      waitlistPosition: null,
      session: {
        id: 's1',
        title: 'State of React',
        room: 'Room A',
        startsAt: '2099-12-01T09:00:00Z',
        endsAt: '2099-12-01T10:00:00Z',
      },
      event: { id: 'e1', title: 'Kyiv Frontend Summit', city: 'Kyiv', venue: 'Main Hall' },
    };
    const { calls } = showEvent(
      [session({})],
      [
        { method: 'post', url: '/my-registrations', status: 201, body: booked },
        {
          method: 'get',
          url: '/catalog/e1',
          status: 200,
          body: detail([session({ myRegistration: { id: 'r1', status: 'CONFIRMED' } })]),
        },
      ],
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Book State of React' }));

    expect(await screen.findByText('Seat booked')).toBeInTheDocument();
    expect(JSON.parse(String(calls.find((call) => call.method === 'post')?.data))).toEqual({
      sessionId: 's1',
    });
    expect(await screen.findByText('Confirmed')).toBeInTheDocument();
  });

  it('offers the waitlist when a session is full and reports the place', async () => {
    const waitlisted: MyRegistration = {
      id: 'r1',
      status: 'WAITLISTED',
      createdAt: '2026-11-14T10:00:00Z',
      cancelledAt: null,
      waitlistPosition: 3,
      session: {
        id: 's1',
        title: 'State of React',
        room: null,
        startsAt: '2099-12-01T09:00:00Z',
        endsAt: '2099-12-01T10:00:00Z',
      },
      event: { id: 'e1', title: 'Kyiv Frontend Summit', city: 'Kyiv', venue: 'Main Hall' },
    };
    showEvent(
      [session({ seatsLeft: 0 })],
      [{ method: 'post', url: '/my-registrations', status: 201, body: waitlisted }],
    );

    const button = await screen.findByRole('button', { name: 'Book State of React' });
    expect(button).toHaveTextContent('Join waitlist');
    await userEvent.click(button);

    expect(await screen.findByText('You are number 3 on the waitlist')).toBeInTheDocument();
  });

  it('shows the API refusal, such as a schedule conflict', async () => {
    showEvent(
      [session({})],
      [
        {
          method: 'post',
          url: '/my-registrations',
          status: 409,
          body: {
            statusCode: 409,
            code: 'SCHEDULE_CONFLICT',
            message: 'You already have a confirmed session at this time',
            requestId: 'r',
          },
        },
      ],
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Book State of React' }));

    expect(
      await screen.findByText(/already have a confirmed session at this time/),
    ).toBeInTheDocument();
  });

  it.each([
    [session({ myRegistration: { id: 'r1', status: 'WAITLISTED' } }), 'Waitlisted'],
    [
      session({
        isUpcoming: false,
        startsAt: '2000-01-01T09:00:00Z',
        endsAt: '2999-01-01T10:00:00Z',
      }),
      'Started',
    ],
    [
      session({
        isUpcoming: false,
        startsAt: '2000-01-01T09:00:00Z',
        endsAt: '2000-01-01T10:00:00Z',
      }),
      'Ended',
    ],
  ])('offers no booking for a held or started session', async (item, text) => {
    showEvent([item]);

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book State of React' })).not.toBeInTheDocument();
  });

  it('reports a waitlist place without a known position plainly', async () => {
    const waitlisted: MyRegistration = {
      id: 'r1',
      status: 'WAITLISTED',
      createdAt: '2026-11-14T10:00:00Z',
      cancelledAt: null,
      waitlistPosition: null,
      session: {
        id: 's1',
        title: 'State of React',
        room: null,
        startsAt: '2099-12-01T09:00:00Z',
        endsAt: '2099-12-01T10:00:00Z',
      },
      event: { id: 'e1', title: 'Kyiv Frontend Summit', city: 'Kyiv', venue: 'Main Hall' },
    };
    showEvent(
      [session({ seatsLeft: 0 })],
      [{ method: 'post', url: '/my-registrations', status: 201, body: waitlisted }],
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Book State of React' }));

    expect(await screen.findByText('Added to the waitlist')).toBeInTheDocument();
  });

  it('cannot send the same booking twice while the page refreshes', async () => {
    const booked: MyRegistration = {
      id: 'r1',
      status: 'CONFIRMED',
      createdAt: '2026-11-14T10:00:00Z',
      cancelledAt: null,
      waitlistPosition: null,
      session: {
        id: 's1',
        title: 'State of React',
        room: null,
        startsAt: '2099-12-01T09:00:00Z',
        endsAt: '2099-12-01T10:00:00Z',
      },
      event: { id: 'e1', title: 'Kyiv Frontend Summit', city: 'Kyiv', venue: 'Main Hall' },
    };
    showEvent(
      [session({})],
      [{ method: 'post', url: '/my-registrations', status: 201, body: booked }],
    );
    const button = await screen.findByRole('button', { name: 'Book State of React' });

    await userEvent.click(button);
    await screen.findByText('Seat booked');

    expect(button).toBeDisabled();
  });

  it('lets the customer book again after cancelling', async () => {
    showEvent([session({ myRegistration: { id: 'r1', status: 'CANCELLED' } })]);

    expect(await screen.findByRole('button', { name: 'Book State of React' })).toBeInTheDocument();
  });

  it('explains when the event is not available', async () => {
    mockHttp([
      signedIn,
      { method: 'get', url: '/catalog/e1', status: 404, body: { message: 'Event not found' } },
    ]);
    renderAdminPage({ path: '/catalog/e1', route: '/catalog/:id', element: <CatalogShow /> });

    expect(await screen.findByText('This event is not available.')).toBeInTheDocument();
  });
});
