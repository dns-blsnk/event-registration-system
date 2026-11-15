import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { EventList } from './event-list';

import type { Role } from '@ers/shared';

const REPEATS = 10;

function signedIn(role: Role): MockRoute {
  return {
    method: 'get',
    url: '/auth/session',
    status: 200,
    body: { user: { id: 'u1', email: 'u@demo.test', name: 'U', role }, csrfToken: 't' },
  };
}

/** The same answer several times: every filter change refetches the list and the options. */
function repeated(route: MockRoute): MockRoute[] {
  return Array.from({ length: REPEATS }, () => route);
}

const events: MockRoute = { method: 'get', url: '/events', status: 200, body: [] };
const tags: MockRoute = {
  method: 'get',
  url: '/tags',
  status: 200,
  body: [{ id: 't1', name: 'AI', eventCount: 2 }],
};
const organizers: MockRoute = {
  method: 'get',
  url: '/users',
  status: 200,
  body: [
    {
      id: 'o1',
      name: 'Olena Organizer',
      email: 'olena@demo.test',
      role: 'ORGANIZER',
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'a1',
      name: 'Ada Admin',
      email: 'ada@demo.test',
      role: 'ADMIN',
      createdAt: '2026-10-01T00:00:00Z',
    },
  ],
};

function eventsQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/events')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

/** Types a day into a date field and leaves it, which is when a day filter applies. */
function pickDay(field: HTMLElement, day: string): void {
  fireEvent.change(field, { target: { value: day } });
  fireEvent.blur(field);
}

function renderList(): void {
  renderAdminPage({ path: '/events', route: '/events', element: <EventList /> });
}

describe('event filters', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('filters by a tag picked from the server-searched list', async () => {
    const { calls } = mockHttp([signedIn('ORGANIZER'), ...repeated(events), ...repeated(tags)]);
    renderList();

    await userEvent.click(await screen.findByRole('combobox', { name: 'Tag' }));
    await userEvent.click(await screen.findByRole('option', { name: 'AI' }));

    await waitFor(() => {
      expect(eventsQuery(calls)).toMatchObject({ tagId: 't1', _start: '0' });
    });
  });

  it('filters by local start days, sent as the first and last moment of each day', async () => {
    const { calls } = mockHttp([signedIn('ORGANIZER'), ...repeated(events), ...repeated(tags)]);
    renderList();

    pickDay(await screen.findByLabelText('Starts from'), '2026-12-01');
    await waitFor(() => {
      expect(eventsQuery(calls)).toMatchObject({ startsFrom: new Date(2026, 11, 1).toISOString() });
    });
    pickDay(screen.getByLabelText('Starts until'), '2026-12-31');

    await waitFor(() => {
      expect(eventsQuery(calls)).toMatchObject({
        startsTo: new Date(2026, 11, 31, 23, 59, 59, 999).toISOString(),
      });
    });
    expect(screen.getByLabelText('Starts from')).toHaveAttribute('max', '2026-12-31');
  });

  it('does not refetch while a day is still being typed, and clears a removed day', async () => {
    const { calls } = mockHttp([signedIn('ORGANIZER'), ...repeated(events), ...repeated(tags)]);
    renderList();
    const from = await screen.findByLabelText('Starts from');
    await screen.findByRole('combobox', { name: 'Tag' });
    const before = calls.filter((call) => call.url?.startsWith('/events')).length;

    fireEvent.change(from, { target: { value: '2026-12-01' } });
    expect(calls.filter((call) => call.url?.startsWith('/events'))).toHaveLength(before);

    fireEvent.blur(from);
    await waitFor(() => {
      expect(eventsQuery(calls)).toHaveProperty('startsFrom');
    });
    pickDay(screen.getByLabelText('Starts from'), '');
    await waitFor(() => {
      expect(eventsQuery(calls)).not.toHaveProperty('startsFrom');
    });
  });

  it('removes the tag filter when the tag is cleared', async () => {
    const { calls } = mockHttp([signedIn('ORGANIZER'), ...repeated(events), ...repeated(tags)]);
    renderList();
    await userEvent.click(await screen.findByRole('combobox', { name: 'Tag' }));
    await userEvent.click(await screen.findByRole('option', { name: 'AI' }));
    await waitFor(() => {
      expect(eventsQuery(calls)).toHaveProperty('tagId', 't1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(eventsQuery(calls)).not.toHaveProperty('tagId');
    });
  });

  it('lets an admin filter by any event owner, admins included, with the role shown', async () => {
    const { calls } = mockHttp([
      signedIn('ADMIN'),
      ...repeated(events),
      ...repeated(tags),
      ...repeated(organizers),
    ]);
    renderList();

    await userEvent.click(await screen.findByRole('combobox', { name: 'Organizer' }));
    expect(await screen.findByRole('option', { name: 'Ada Admin (Admin)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'Olena Organizer (Organizer)' }));

    await waitFor(() => {
      expect(eventsQuery(calls)).toMatchObject({ organizerId: 'o1' });
    });
    // Only possible owners are offered, never customers.
    const usersCall = calls.find((call) => call.url?.startsWith('/users'));
    expect(
      new URL(String(usersCall?.url), 'http://admin.test').searchParams.get('canOrganize'),
    ).toBe('true');
  });

  it('offers no organizer filter to an organizer, who only sees their own events', async () => {
    mockHttp([signedIn('ORGANIZER'), ...repeated(events), ...repeated(tags)]);
    renderList();

    expect(await screen.findByRole('combobox', { name: 'Tag' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Organizer' })).not.toBeInTheDocument();
  });

  it('keeps an unknown tag from the URL visible so it can be cleared', async () => {
    mockHttp([
      signedIn('ORGANIZER'),
      ...repeated(events),
      ...repeated(tags),
      {
        method: 'get',
        url: '/tags/00000000-0000-4000-8000-000000000000',
        status: 404,
        body: { message: 'Tag not found' },
      },
    ]);
    renderAdminPage({
      path: '/events?filters[0][field]=tagId&filters[0][operator]=eq&filters[0][value]=00000000-0000-4000-8000-000000000000',
      route: '/events',
      element: <EventList />,
    });

    expect(await screen.findByDisplayValue('Not found (clear to remove)')).toBeInTheDocument();
  });
});
