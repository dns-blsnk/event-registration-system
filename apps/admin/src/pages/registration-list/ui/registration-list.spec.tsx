import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';
import { bulkSummary } from '@/widgets/registration-table';

import { RegistrationList } from './registration-list';

import type { BulkStatusResponse, RegistrationListItem } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

const HOUR_MS = 3_600_000;
/** Sessions relative to now, so the staff rules (attend after the start, cancel before) hold. */
const STARTED = new Date(Date.now() - HOUR_MS).toISOString();
const UPCOMING = new Date(Date.now() + 24 * HOUR_MS).toISOString();

function registration(
  id: string,
  name: string,
  {
    status = 'CONFIRMED',
    startsAt = UPCOMING,
  }: Partial<{ status: RegistrationListItem['status']; startsAt: string }> = {},
): RegistrationListItem {
  return {
    id,
    status,
    createdAt: '2026-11-01T09:00:00Z',
    cancelledAt: null,
    customer: { id: `c-${id}`, name, email: `${id}@demo.test` },
    session: { id: 's1', title: 'State of React', startsAt },
    event: { id: 'e1', title: 'Kyiv Frontend Summit', status: 'PUBLISHED' },
  };
}

const rows = [registration('r1', 'Ann Customer'), registration('r2', 'Bob Customer')];
const list: MockRoute = { method: 'get', url: '/registrations', status: 200, body: rows };

function bodyOf(call: { data?: unknown } | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.data)) as Record<string, unknown>;
}

function lastQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/registrations')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

function renderList(): void {
  renderAdminPage({
    path: '/registrations',
    route: '/registrations',
    element: <RegistrationList />,
  });
}

async function selectRow(name: string): Promise<void> {
  const row = await screen.findByRole('row', { name: new RegExp(name) });
  await userEvent.click(within(row).getByRole('checkbox'));
}

describe('RegistrationList', () => {
  it('shows each registration with its customer, event, session and status', async () => {
    mockHttp([signedIn, list]);
    renderList();

    expect(await screen.findByText('Ann Customer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'r1@demo.test' })).toHaveAttribute(
      'href',
      'mailto:r1@demo.test',
    );
    expect(screen.getAllByText('Kyiv Frontend Summit')).toHaveLength(2);
    expect(screen.getAllByText('Confirmed')).toHaveLength(2);
  });

  it('filters by status on the server', async () => {
    const { calls } = mockHttp([signedIn, list, list]);
    renderList();
    await screen.findByText('Ann Customer');

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Waitlisted' }));

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ status: 'WAITLISTED' });
    });
  });

  it('marks the selected registrations attended and keeps rows the server refused selected', async () => {
    const started = [
      registration('r1', 'Ann Customer', { startsAt: STARTED }),
      registration('r2', 'Bob Customer', { startsAt: STARTED }),
    ];
    const startedList: MockRoute = { ...list, body: started };
    const response: BulkStatusResponse = {
      results: [
        { id: 'r1', ok: true, status: 'ATTENDED' },
        { id: 'r2', ok: false, code: 'CONFLICT', message: 'The event has not started yet' },
      ],
    };
    const { calls } = mockHttp([
      signedIn,
      startedList,
      { method: 'post', url: '/registrations/bulk-status', status: 200, body: response },
      startedList,
    ]);
    renderList();
    await selectRow('Ann Customer');
    await selectRow('Bob Customer');
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark attended (2)' }));

    expect(
      await screen.findByText(
        '1 registration(s) updated. Not changed: 1 × The event has not started yet',
      ),
    ).toBeInTheDocument();
    expect(bodyOf(calls.find((call) => call.method === 'post'))).toEqual({
      ids: ['r1', 'r2'],
      status: 'ATTENDED',
    });
    expect(await screen.findByText('1 selected')).toBeInTheDocument();
  });

  it('sizes the counter and buttons for the largest count, so a growing count shifts nothing', async () => {
    const started = [registration('r1', 'Ann Customer', { startsAt: STARTED })];
    mockHttp([signedIn, { ...list, body: started }]);
    renderList();
    await selectRow('Ann Customer');

    // The widest version is laid out, invisible and silent, under the visible text.
    expect(screen.getByText('100 selected')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Mark attended (100)')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Mark attended (1)' })).toBeInTheDocument();
  });

  it('cancels bookings only after confirmation', async () => {
    const { calls } = mockHttp([
      signedIn,
      list,
      {
        method: 'post',
        url: '/registrations/bulk-status',
        status: 200,
        body: {
          results: [{ id: 'r1', ok: true, status: 'CANCELLED' }],
        } satisfies BulkStatusResponse,
      },
      list,
    ]);
    renderList();
    await selectRow('Ann Customer');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel bookings (1)' }));
    const dialog = await screen.findByRole('dialog');
    expect(calls.some((call) => call.method === 'post')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel bookings' }));

    expect(await screen.findByText('1 registration(s) updated')).toBeInTheDocument();
    expect(bodyOf(calls.find((call) => call.method === 'post'))).toEqual({
      ids: ['r1'],
      status: 'CANCELLED',
    });
  });

  it('does not cancel anything when the confirmation is declined', async () => {
    const { calls } = mockHttp([signedIn, list]);
    renderList();
    await selectRow('Ann Customer');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel bookings (1)' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep bookings' }),
    );

    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('lists every distinct reason rows were refused', () => {
    expect(
      bulkSummary({
        results: [
          { id: 'a', ok: true, status: 'CANCELLED' },
          { id: 'b', ok: false, code: 'CONFLICT', message: 'Already final' },
          { id: 'c', ok: false, code: 'CONFLICT', message: 'Already final' },
          { id: 'd', ok: false, code: 'NOT_FOUND', message: 'Registration not found' },
        ],
      }),
    ).toEqual({
      type: 'error',
      message:
        '1 registration(s) updated. Not changed: 2 × Already final; 1 × Registration not found',
    });
  });

  it('sends only the rows an action applies to and reports the others as skipped', async () => {
    const mixed = [
      registration('r1', 'Ann Customer', { startsAt: STARTED }),
      // Can still be cancelled, but not marked attended before its session starts.
      registration('r2', 'Bob Customer', { startsAt: UPCOMING }),
    ];
    const { calls } = mockHttp([
      signedIn,
      { ...list, body: mixed },
      {
        method: 'post',
        url: '/registrations/bulk-status',
        status: 200,
        body: {
          results: [{ id: 'r1', ok: true, status: 'ATTENDED' }],
        } satisfies BulkStatusResponse,
      },
      { ...list, body: mixed },
    ]);
    renderList();
    await selectRow('Ann Customer');
    await selectRow('Bob Customer');

    await userEvent.click(screen.getByRole('button', { name: 'Mark attended (1)' }));

    expect(bodyOf(calls.find((call) => call.method === 'post'))).toEqual({
      ids: ['r1'],
      status: 'ATTENDED',
    });
    expect(
      await screen.findByText(
        '1 registration(s) updated. Skipped: 1 × the session has not started yet',
      ),
    ).toBeInTheDocument();
    // The skipped row stays selected for a second look.
    expect(await screen.findByText('1 selected')).toBeInTheDocument();
  });

  it('switches an action off, with the reason, when it applies to none of the selection', async () => {
    mockHttp([
      signedIn,
      { ...list, body: [registration('r1', 'Ann Customer', { startsAt: UPCOMING })] },
    ]);
    renderList();
    await selectRow('Ann Customer');

    expect(screen.getByRole('button', { name: 'Mark attended' })).toBeDisabled();
    expect(
      screen.getByLabelText('Not possible for the selection: 1 × the session has not started yet'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel bookings (1)' })).toBeEnabled();
  });

  it('does not let a row be ticked when no action applies to it', async () => {
    mockHttp([
      signedIn,
      {
        ...list,
        body: [
          registration('r1', 'Ann Customer', { startsAt: UPCOMING }),
          registration('r2', 'Bob Customer', { status: 'CANCELLED' }),
        ],
      },
    ]);
    renderList();

    const bob = await screen.findByRole('row', { name: /Bob Customer/ });
    expect(within(bob).getByRole('checkbox')).toBeDisabled();
  });

  it('offers no selection at all on a page where no action applies to any row', async () => {
    mockHttp([
      signedIn,
      { ...list, body: [registration('r1', 'Ann Customer', { status: 'ATTENDED' })] },
    ]);
    renderList();

    expect(await screen.findByText('Ann Customer')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('clears the selection when the order changes', async () => {
    mockHttp([signedIn, list, list]);
    renderList();
    await selectRow('Ann Customer');
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('columnheader', { name: /Status/ }));

    expect(await screen.findByText('0 selected')).toBeInTheDocument();
  });

  it('offers bulk actions only with a selection', async () => {
    mockHttp([signedIn, list]);
    renderList();
    await screen.findByText('Ann Customer');

    expect(screen.getByRole('button', { name: 'Mark attended' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel bookings' })).toBeDisabled();
  });
});
