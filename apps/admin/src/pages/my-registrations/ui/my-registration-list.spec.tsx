import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { MyRegistrationList } from './my-registration-list';

import type { MyRegistration } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'c1', email: 'c@demo.test', name: 'C', role: 'CUSTOMER' }, csrfToken: 't' },
};

function booking(overrides: Partial<MyRegistration> = {}): MyRegistration {
  return {
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
    ...overrides,
  };
}

const PAST = { startsAt: '2000-01-01T09:00:00Z', endsAt: '2000-01-01T10:00:00Z' };

function list(rows: MyRegistration[]): MockRoute {
  return { method: 'get', url: '/my-registrations', status: 200, body: rows };
}

function renderList(): void {
  renderAdminPage({
    path: '/my-registrations',
    route: '/my-registrations',
    element: <MyRegistrationList />,
  });
}

describe('MyRegistrationList', () => {
  it('shows each booking with a link to its event and the waitlist place', async () => {
    mockHttp([signedIn, list([booking({ status: 'WAITLISTED', waitlistPosition: 2 })])]);
    renderList();

    expect(await screen.findByRole('link', { name: 'Kyiv Frontend Summit' })).toHaveAttribute(
      'href',
      '/catalog/e1',
    );
    expect(screen.getByText('Waitlisted')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('offers no cancel and no catalog link for past, cancelled or attended bookings', async () => {
    mockHttp([
      signedIn,
      list([
        booking({ id: 'r1', session: { ...booking().session, title: 'Old talk', ...PAST } }),
        booking({
          id: 'r2',
          status: 'CANCELLED',
          session: { ...booking().session, title: 'Dropped talk' },
        }),
        booking({
          id: 'r3',
          status: 'ATTENDED',
          session: { ...booking().session, title: 'Seen talk', ...PAST },
        }),
      ]),
    ]);
    renderList();

    expect(await screen.findByText('Old talk')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancel booking for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kyiv Frontend Summit' })).not.toBeInTheDocument();
  });

  it('cancels a booking only after confirmation', async () => {
    const { calls } = mockHttp([
      signedIn,
      list([booking()]),
      {
        method: 'post',
        url: '/my-registrations/r1/cancel',
        status: 200,
        body: booking({ status: 'CANCELLED' }),
      },
      list([booking({ status: 'CANCELLED' })]),
    ]);
    renderList();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel booking for State of React' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(calls.some((call) => call.method === 'post')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    expect(await screen.findByText('Booking cancelled')).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.some((call) => call.url === '/my-registrations/r1/cancel')).toBe(true);
    });
  });

  it('keeps the booking when the confirmation is declined', async () => {
    const { calls } = mockHttp([signedIn, list([booking()])]);
    renderList();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel booking for State of React' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep booking' }),
    );

    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('shows the API refusal, such as a session that has just started', async () => {
    mockHttp([
      signedIn,
      list([booking()]),
      {
        method: 'post',
        url: '/my-registrations/r1/cancel',
        status: 409,
        body: {
          statusCode: 409,
          code: 'SESSION_STARTED',
          message: 'This session has already started',
          requestId: 'r',
        },
      },
    ]);
    renderList();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel booking for State of React' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel booking' }),
    );

    expect(await screen.findByText(/This session has already started/)).toBeInTheDocument();
  });

  it('filters by status on the server', async () => {
    const { calls } = mockHttp([signedIn, list([booking()]), list([])]);
    renderList();
    await screen.findByText('State of React');

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cancelled' }));

    await waitFor(() => {
      const last = calls.filter((call) => call.url?.startsWith('/my-registrations')).at(-1);
      expect(String(last?.url)).toContain('status=CANCELLED');
    });
  });
});
