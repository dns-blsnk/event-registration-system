import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { EventShow } from './event-show';

import type { EventDetail, EventStatus, SessionListItem } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

function detail(
  status: EventStatus,
  bannerUrl: string | null = null,
  overrides: Partial<EventDetail> = {},
): EventDetail {
  return {
    id: 'e1',
    title: 'Kyiv Frontend Summit',
    slug: 'kyiv-frontend-summit',
    city: 'Kyiv',
    venue: 'Main Hall',
    startsAt: '2099-12-01T09:00:00Z',
    endsAt: '2099-12-02T18:00:00Z',
    status,
    organizer: { id: 'o1', name: 'Olena Organizer' },
    tags: [{ id: 't1', name: 'Frontend' }],
    sessionsCount: 1,
    capacity: 50,
    confirmedCount: 10,
    fillRate: 0.2,
    description: 'Two days of talks.',
    bannerUrl,
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-01T09:00:00Z',
    ...overrides,
  };
}

const session: SessionListItem = {
  id: 's1',
  eventId: 'e1',
  eventTitle: 'Kyiv Frontend Summit',
  title: 'State of React',
  speaker: 'Ann Speaker',
  room: 'Room A',
  startsAt: '2026-12-01T09:00:00Z',
  endsAt: '2026-12-01T10:00:00Z',
  capacity: 50,
  confirmedCount: 10,
  seatsLeft: 40,
  fillRate: 0.2,
  waitlistCount: 2,
};

function show(
  status: EventStatus,
  extra: MockRoute[] = [],
  bannerUrl: string | null = null,
  overrides: Partial<EventDetail> = {},
) {
  const mock = mockHttp([
    signedIn,
    { method: 'get', url: '/events/e1', status: 200, body: detail(status, bannerUrl, overrides) },
    { method: 'get', url: '/sessions', status: 200, body: [session] },
    ...extra,
  ]);
  renderAdminPage({ path: '/events/e1', route: '/events/:id', element: <EventShow /> });
  return mock;
}

describe('EventShow', () => {
  it('shows the event, its tags and its sessions with seats', async () => {
    const { calls } = show('PUBLISHED', [], 'https://files.test/banner.png');

    expect(
      await screen.findByRole('heading', { name: 'Kyiv Frontend Summit' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    // Decorative behind the title (alt=""), so it is found by its source, not by a name.
    expect(document.querySelector('img[src="https://files.test/banner.png"]')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Status' })).toHaveTextContent('Published');
    expect(screen.getByRole('progressbar', { name: 'Filled' })).toBeInTheDocument();
    expect(await screen.findByText('State of React')).toBeInTheDocument();
    const sessionsCall = calls.find((call) => call.url?.startsWith('/sessions'));
    expect(
      new URL(String(sessionsCall?.url), 'http://admin.test').searchParams.get('eventId'),
    ).toBe('e1');
  });

  it('offers publish and cancel for a draft, but not complete', async () => {
    show('DRAFT');

    expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel event' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
  });

  it('does not offer to complete an event that has not started yet', async () => {
    show('PUBLISHED', [], null, {
      startsAt: '2099-01-01T09:00:00Z',
      endsAt: '2099-01-02T09:00:00Z',
    });

    expect(await screen.findByRole('button', { name: 'Cancel event' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
  });

  it('offers to complete an event that is running', async () => {
    show('PUBLISHED', [], null, {
      startsAt: '2020-01-01T09:00:00Z',
      endsAt: '2099-01-02T09:00:00Z',
    });

    expect(await screen.findByRole('button', { name: 'Complete' })).toBeInTheDocument();
  });

  it('does not offer to publish a draft without sessions', async () => {
    show('DRAFT', [], null, {
      sessionsCount: 0,
      startsAt: '2099-01-01T09:00:00Z',
      endsAt: '2099-01-02T09:00:00Z',
    });

    expect(await screen.findByRole('button', { name: 'Cancel event' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });

  it('offers to publish a draft as soon as its first session is added', async () => {
    const dates = { startsAt: '2099-01-01T09:00:00Z', endsAt: '2099-01-02T09:00:00Z' };
    show(
      'DRAFT',
      [
        { method: 'post', url: '/sessions', status: 201, body: session },
        {
          method: 'get',
          url: '/events/e1',
          status: 200,
          body: detail('DRAFT', null, { ...dates, sessionsCount: 1 }),
        },
        { method: 'get', url: '/sessions', status: 200, body: [session] },
      ],
      null,
      { ...dates, sessionsCount: 0 },
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Add session' }));
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Workshop');
    await userEvent.type(within(dialog).getByLabelText(/^Starts/), '2099-01-01T12:00');
    await userEvent.type(within(dialog).getByLabelText(/^Ends/), '2099-01-01T13:00');
    await userEvent.type(within(dialog).getByRole('spinbutton', { name: 'Capacity' }), '30');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('stops offering to publish a draft once its only session is deleted', async () => {
    const dates = { startsAt: '2099-01-01T09:00:00Z', endsAt: '2099-01-02T09:00:00Z' };
    const empty = { ...session, confirmedCount: 0, seatsLeft: 50, fillRate: 0, waitlistCount: 0 };
    mockHttp([
      signedIn,
      { method: 'get', url: '/events/e1', status: 200, body: detail('DRAFT', null, dates) },
      { method: 'get', url: '/sessions', status: 200, body: [empty] },
      { method: 'delete', url: '/sessions/s1', status: 204 },
      {
        method: 'get',
        url: '/events/e1',
        status: 200,
        body: detail('DRAFT', null, { ...dates, sessionsCount: 0 }),
      },
      { method: 'get', url: '/sessions', status: 200, body: [] },
    ]);
    renderAdminPage({ path: '/events/e1', route: '/events/:id', element: <EventShow /> });

    expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete State of React' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    });
  });

  it('explains when the event cannot be loaded', async () => {
    mockHttp([
      signedIn,
      {
        method: 'get',
        url: '/events/e1',
        status: 404,
        body: { statusCode: 404, code: 'NOT_FOUND', message: 'Event not found', requestId: 'r' },
      },
    ]);
    renderAdminPage({ path: '/events/e1', route: '/events/:id', element: <EventShow /> });

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });

  it('offers no actions for a cancelled event', async () => {
    show('CANCELLED');

    await screen.findByRole('heading', { name: 'Kyiv Frontend Summit' });
    expect(
      screen.queryByRole('button', { name: /publish|complete|cancel event/i }),
    ).not.toBeInTheDocument();
  });

  it('publishes a draft through the API', async () => {
    const { calls } = show('DRAFT', [
      { method: 'post', url: '/events/e1/publish', status: 200, body: detail('PUBLISHED') },
      { method: 'get', url: '/events/e1', status: 200, body: detail('PUBLISHED') },
    ]);

    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(
        calls.some((call) => call.method === 'post' && call.url === '/events/e1/publish'),
      ).toBe(true);
    });
  });

  it('asks before cancelling and cancels only after confirmation', async () => {
    const { calls } = show('PUBLISHED', [
      { method: 'post', url: '/events/e1/cancel', status: 200, body: detail('CANCELLED') },
      { method: 'get', url: '/events/e1', status: 200, body: detail('CANCELLED') },
    ]);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel event' }));
    expect(await screen.findByRole('dialog', { name: 'Cancel this event?' })).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/events/e1/cancel')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Keep event' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.some((call) => call.url === '/events/e1/cancel')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel event' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel event' }));
    await waitFor(() => {
      expect(calls.some((call) => call.method === 'post' && call.url === '/events/e1/cancel')).toBe(
        true,
      );
    });
  });
});
