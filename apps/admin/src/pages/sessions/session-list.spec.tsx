import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { SessionList } from './session-list';

import type { SessionListItem } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/me',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

const session: SessionListItem = {
  id: 's1',
  eventId: 'e1',
  eventTitle: 'Kyiv Frontend Summit',
  title: 'State of React',
  speaker: 'Ann Speaker',
  room: 'Room A',
  startsAt: '2099-12-01T09:00:00Z',
  endsAt: '2099-12-01T10:00:00Z',
  capacity: 50,
  confirmedCount: 46,
  seatsLeft: 4,
  fillRate: 0.92,
  waitlistCount: 3,
};

function sessionsRoute(body: SessionListItem[] = [session]): MockRoute {
  return { method: 'get', url: '/sessions', status: 200, body };
}

function lastQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/sessions')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

describe('SessionList', () => {
  it('shows sessions with a link to their event, seats left and waitlist', async () => {
    mockHttp([signedIn, sessionsRoute()]);

    renderAdminPage({ path: '/sessions', route: '/sessions', element: <SessionList /> });

    expect(await screen.findByRole('link', { name: 'State of React' })).toHaveAttribute(
      'href',
      '/sessions/s1',
    );
    expect(screen.getByRole('link', { name: 'Kyiv Frontend Summit' })).toHaveAttribute(
      'href',
      '/events/e1',
    );
    expect(screen.getByText('Ann Speaker')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /State of React/ });
    // Seats left as a bar: 92% taken, so red, and labelled with what is left.
    const seats = within(row).getByRole('progressbar', { name: 'Seats left' });
    expect(seats).toHaveAttribute('aria-valuenow', '92');
    expect(seats).toHaveAttribute('aria-valuetext', '4 left');
    expect(within(row).getByRole('gridcell', { name: '3' })).toBeInTheDocument();
  });

  it('labels a session with no seats left as full', async () => {
    mockHttp([
      signedIn,
      sessionsRoute([{ ...session, seatsLeft: 0, confirmedCount: 50, fillRate: 1 }]),
    ]);
    renderAdminPage({ path: '/sessions', route: '/sessions', element: <SessionList /> });

    expect(await screen.findByRole('progressbar', { name: 'Seats left' })).toHaveAttribute(
      'aria-valuetext',
      'Full',
    );
  });

  it('asks the server for almost full sessions only when the switch is on', async () => {
    const { calls } = mockHttp([signedIn, sessionsRoute(), sessionsRoute(), sessionsRoute()]);
    renderAdminPage({ path: '/sessions', route: '/sessions', element: <SessionList /> });
    await screen.findByText('State of React');
    expect(lastQuery(calls)).not.toHaveProperty('almostFull');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Almost full' }));
    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ almostFull: 'true', _start: '0' });
    });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Almost full' }));
    await waitFor(() => {
      expect(lastQuery(calls)).not.toHaveProperty('almostFull');
    });
  });

  it('searches by title, speaker or room', async () => {
    const { calls } = mockHttp([signedIn, sessionsRoute(), sessionsRoute([])]);
    renderAdminPage({ path: '/sessions', route: '/sessions', element: <SessionList /> });
    await screen.findByText('State of React');

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), '  react {Enter}');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ q: 'react' });
    });
  });
});
