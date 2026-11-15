import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { CatalogShow } from './catalog-show';

import type {
  CatalogEventDetail,
  CatalogEventListItem,
  CatalogSession,
  MyRegistration,
} from '@ers/shared';

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
    fillRate: 0.76,
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

function showEvent(sessions: CatalogSession[], extra: MockRoute[] = []) {
  const mock = mockHttp([
    signedIn,
    { method: 'get', url: '/catalog/e1', status: 200, body: detail(sessions) },
    ...extra,
  ]);
  renderAdminPage({ path: '/catalog/e1', route: '/catalog/:id', element: <CatalogShow /> });
  return mock;
}

describe('CatalogShow', () => {
  it('opens scrolled to the session a link points at, and marks it', async () => {
    // jsdom lays nothing out, so it has no scrolling of its own.
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
    });
    onTestFinished(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });
    mockHttp([
      signedIn,
      { method: 'get', url: '/catalog/e1', status: 200, body: detail([session({ id: 's2' })]) },
    ]);
    renderAdminPage({
      path: '/catalog/e1#session-s2',
      route: '/catalog/:id',
      element: <CatalogShow />,
    });

    expect(await screen.findByText('State of React')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(document.getElementById('session-s2')).toHaveStyle({ borderWidth: '2px' });
  });

  it('shows the event and its sessions with seats', async () => {
    showEvent([session({})]);

    expect(
      await screen.findByRole('heading', { name: 'Kyiv Frontend Summit' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Two days of talks.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Seats left' })).toHaveAttribute(
      'aria-valuetext',
      '12 left',
    );
    expect(screen.getByText(/50 seats/)).toBeInTheDocument();
    // Customers see seats per session, not the event's overall fill rate.
    expect(screen.queryByRole('progressbar', { name: 'Filled' })).not.toBeInTheDocument();
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
      event: {
        id: 'e1',
        title: 'Kyiv Frontend Summit',
        city: 'Kyiv',
        venue: 'Main Hall',
        status: 'PUBLISHED',
        endsAt: '2099-12-02T18:00:00Z',
      },
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
      event: {
        id: 'e1',
        title: 'Kyiv Frontend Summit',
        city: 'Kyiv',
        venue: 'Main Hall',
        status: 'PUBLISHED',
        endsAt: '2099-12-02T18:00:00Z',
      },
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
      event: {
        id: 'e1',
        title: 'Kyiv Frontend Summit',
        city: 'Kyiv',
        venue: 'Main Hall',
        status: 'PUBLISHED',
        endsAt: '2099-12-02T18:00:00Z',
      },
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
      event: {
        id: 'e1',
        title: 'Kyiv Frontend Summit',
        city: 'Kyiv',
        venue: 'Main Hall',
        status: 'PUBLISHED',
        endsAt: '2099-12-02T18:00:00Z',
      },
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

  it('undoes a booking made by mistake from its notice, and the seat can be booked again', async () => {
    const booked = {
      id: 'r1',
      status: 'CONFIRMED',
      createdAt: '2026-11-14T10:00:00Z',
      cancelledAt: null,
      waitlistPosition: null,
    };
    const { calls } = showEvent(
      [session({})],
      [
        { method: 'post', url: '/my-registrations', status: 201, body: booked },
        { method: 'get', url: '/catalog/e1', status: 200, body: detail([session({})]) },
        {
          method: 'post',
          url: '/my-registrations/r1/cancel',
          status: 200,
          body: { ...booked, status: 'CANCELLED' },
        },
        { method: 'get', url: '/catalog/e1', status: 200, body: detail([session({})]) },
      ],
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Book State of React' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('Booking undone')).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/my-registrations/r1/cancel')).toBe(true);
    expect(screen.getByRole('button', { name: 'Book State of React' })).toBeEnabled();
  });

  it('offers to cancel a held booking next to it while the session has not started', async () => {
    showEvent([session({ myRegistration: { id: 'r1', status: 'WAITLISTED' } })]);

    expect(
      await screen.findByRole('button', { name: 'Cancel booking for State of React' }),
    ).toBeInTheDocument();
  });

  it('offers no cancel for a booking already marked attended', async () => {
    showEvent([session({ myRegistration: { id: 'r1', status: 'ATTENDED' } })]);

    expect(await screen.findByText('Attended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancel booking for/ })).not.toBeInTheDocument();
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
