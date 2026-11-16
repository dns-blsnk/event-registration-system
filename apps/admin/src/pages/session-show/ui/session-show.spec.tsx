import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { SessionShow } from './session-show';

import type { BulkStatusResponse, RegistrationListItem, SessionListItem } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

const session: SessionListItem = {
  id: 's1',
  eventId: 'e1',
  eventTitle: 'Kyiv Frontend Summit',
  title: 'State of React',
  speaker: null,
  room: 'Room A',
  startsAt: '2099-12-01T09:00:00Z',
  endsAt: '2099-12-01T10:00:00Z',
  capacity: 50,
  confirmedCount: 48,
  seatsLeft: 2,
  fillRate: 0.96,
  waitlistCount: 5,
};

const registration: RegistrationListItem = {
  id: 'r1',
  status: 'CONFIRMED',
  createdAt: '2026-11-01T09:00:00Z',
  cancelledAt: null,
  customer: { id: 'c1', name: 'Ann Customer', email: 'ann@demo.test' },
  session: { id: 's1', title: 'State of React', startsAt: '2099-12-01T09:00:00Z' },
  event: { id: 'e1', title: 'Kyiv Frontend Summit', status: 'PUBLISHED' },
};

const registrations: MockRoute = {
  method: 'get',
  url: '/registrations',
  status: 200,
  body: [registration],
};

/** The value shown under a label on the session page, so assertions do not match other text. */
function valueOf(label: string): HTMLElement {
  const caption = screen.getAllByText(label).find((element) => element.tagName === 'SPAN');
  if (caption?.parentElement === null || caption === undefined)
    throw new Error(`No field ${label}`);
  return caption.parentElement;
}

function renderShow(extra: MockRoute[] = []) {
  const mock = mockHttp([
    signedIn,
    { method: 'get', url: '/sessions/s1', status: 200, body: session },
    registrations,
    ...extra,
  ]);
  renderAdminPage({ path: '/sessions/s1', route: '/sessions/:id', element: <SessionShow /> });
  return mock;
}

describe('SessionShow', () => {
  it('shows the session with seats, waitlist and a link to its event', async () => {
    renderShow();

    expect(await screen.findByRole('heading', { name: 'State of React' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kyiv Frontend Summit' })).toHaveAttribute(
      'href',
      '/events/e1',
    );
    expect(valueOf('Waitlist')).toHaveTextContent('5');
    expect(valueOf('Speaker')).toHaveTextContent('—');
  });

  it('lists only this session’s registrations, without repeating event and session', async () => {
    const { calls } = renderShow();

    expect(await screen.findByText('Ann Customer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ann@demo.test' })).toBeInTheDocument();
    const request = calls.find((call) => call.url?.startsWith('/registrations'));
    expect(String(request?.url)).toContain('sessionId=s1');
    expect(screen.queryByRole('columnheader', { name: 'Session' })).not.toBeInTheDocument();
  });

  it('cancels this session’s registrations in bulk and refreshes the seat numbers above', async () => {
    const response: BulkStatusResponse = { results: [{ id: 'r1', ok: true, status: 'CANCELLED' }] };
    const { calls } = renderShow([
      { method: 'post', url: '/registrations/bulk-status', status: 200, body: response },
      registrations,
      {
        method: 'get',
        url: '/sessions/s1',
        status: 200,
        body: { ...session, seatsLeft: 2, waitlistCount: 4 },
      },
    ]);
    const row = await screen.findByRole('row', { name: /Ann Customer/ });

    await userEvent.click(within(row).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel bookings (1)' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel bookings' }),
    );

    await waitFor(() => {
      expect(valueOf('Waitlist')).toHaveTextContent('4');
    });
    expect(calls.some((call) => call.url === '/registrations/bulk-status')).toBe(true);
  });

  it('explains when the session cannot be loaded', async () => {
    mockHttp([
      signedIn,
      { method: 'get', url: '/sessions/s1', status: 404, body: { message: 'Session not found' } },
    ]);
    renderAdminPage({ path: '/sessions/s1', route: '/sessions/:id', element: <SessionShow /> });

    expect(await screen.findByText(/This session could not be loaded/)).toBeInTheDocument();
  });
});
