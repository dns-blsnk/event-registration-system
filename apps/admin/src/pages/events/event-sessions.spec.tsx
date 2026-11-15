import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { EventSessions } from './event-sessions';

import type { SessionListItem } from '@ers/shared';

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
  speaker: 'Ann Speaker',
  room: 'Room A',
  startsAt: '2099-12-01T09:00:00Z',
  endsAt: '2099-12-01T10:00:00Z',
  capacity: 50,
  confirmedCount: 10,
  seatsLeft: 40,
  fillRate: 0.2,
  waitlistCount: 0,
};

const sessions: MockRoute = { method: 'get', url: '/sessions', status: 200, body: [session] };

function bodyOf(call: { data?: unknown } | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.data)) as Record<string, unknown>;
}

function renderSessions(canChange = true): void {
  renderAdminPage({
    path: '/events/e1',
    route: '/events/:id',
    element: <EventSessions eventId="e1" canChange={canChange} />,
  });
}

describe('EventSessions', () => {
  it('offers no changes to the sessions of a completed or cancelled event', async () => {
    mockHttp([signedIn, sessions]);
    renderSessions(false);

    expect(await screen.findByText('State of React')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add session' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit State of React' })).not.toBeInTheDocument();
  });

  it('adds a session through a dialog and sends ISO dates and a number capacity', async () => {
    const { calls } = mockHttp([
      signedIn,
      sessions,
      { method: 'post', url: '/sessions', status: 201, body: { ...session, id: 's2' } },
      sessions,
    ]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Add session' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add session' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Workshop');
    await userEvent.type(within(dialog).getByLabelText(/^Starts/), '2099-12-01T12:00');
    await userEvent.type(within(dialog).getByLabelText(/^Ends/), '2099-12-01T13:00');
    await userEvent.type(within(dialog).getByRole('spinbutton', { name: 'Capacity' }), '30');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(bodyOf(calls.find((call) => call.method === 'post'))).toEqual({
      eventId: 'e1',
      title: 'Workshop',
      startsAt: new Date('2099-12-01T12:00').toISOString(),
      endsAt: new Date('2099-12-01T13:00').toISOString(),
      capacity: 30,
    });
  });

  it('keeps the dialog open and shows the field error the API returns', async () => {
    mockHttp([
      signedIn,
      sessions,
      {
        method: 'post',
        url: '/sessions',
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Invalid',
          details: [
            { field: 'startsAt', messages: ['The session must take place within the event dates'] },
          ],
          requestId: 'r',
        },
      },
    ]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Add session' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add session' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Workshop');
    await userEvent.type(within(dialog).getByLabelText(/^Starts/), '2100-01-01T12:00');
    await userEvent.type(within(dialog).getByLabelText(/^Ends/), '2100-01-01T13:00');
    await userEvent.type(within(dialog).getByRole('spinbutton', { name: 'Capacity' }), '30');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText('The session must take place within the event dates'),
    ).toBeInTheDocument();
  });

  it('does not send a session with empty required fields', async () => {
    const { calls } = mockHttp([signedIn, sessions]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Add session' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }),
    );

    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('edits a session from its row and sends only the changed field', async () => {
    const { calls } = mockHttp([
      signedIn,
      sessions,
      { method: 'patch', url: '/sessions/s1', status: 200, body: { ...session, capacity: 60 } },
      sessions,
    ]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit State of React' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit session' });
    const capacity = within(dialog).getByRole('spinbutton', { name: 'Capacity' });
    expect(capacity).toHaveValue(50);
    await userEvent.clear(capacity);
    await userEvent.type(capacity, '60');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'patch')).toBe(true);
    });
    expect(bodyOf(calls.find((call) => call.method === 'patch'))).toEqual({ capacity: 60 });
  });

  it('offers no edit for an ended session and no delete for a booked one', async () => {
    const ended = {
      ...session,
      id: 's2',
      title: 'Opening',
      startsAt: '2000-01-01T09:00:00Z',
      endsAt: '2000-01-01T10:00:00Z',
    };
    const booked = { ...session, id: 's3', title: 'Keynote', confirmedCount: 1 };
    mockHttp([signedIn, { method: 'get', url: '/sessions', status: 200, body: [ended, booked] }]);
    renderSessions();

    // Access checks resolve asynchronously, so wait for a button that must appear first.
    expect(await screen.findByRole('button', { name: 'Edit Keynote' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Opening' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Keynote' })).not.toBeInTheDocument();
  });

  it('keeps the time and capacity of a running session fixed', async () => {
    const running = {
      ...session,
      startsAt: '2000-01-01T09:00:00Z',
      endsAt: '2999-01-01T10:00:00Z',
    };
    mockHttp([signedIn, { method: 'get', url: '/sessions', status: 200, body: [running] }]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit State of React' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit session' });

    expect(within(dialog).getByRole('spinbutton', { name: 'Capacity' })).toBeDisabled();
    expect(within(dialog).getByLabelText(/^Starts/)).toBeDisabled();
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toBeEnabled();
  });

  it('closes without a request when nothing was changed', async () => {
    const { calls } = mockHttp([signedIn, sessions]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit State of React' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit session' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls.some((call) => call.method === 'patch')).toBe(false);
  });

  it.each([
    ['0', '2099-12-01T13:00', 'A whole number from 1 to 10000'],
    ['2.5', '2099-12-01T13:00', 'A whole number from 1 to 10000'],
    ['30', '2099-12-01T11:00', 'The end must be after the start'],
  ])('refuses capacity %s or end %s before sending', async (capacity, endsAt, message) => {
    const { calls } = mockHttp([signedIn, sessions]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Add session' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add session' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Workshop');
    await userEvent.type(within(dialog).getByLabelText(/^Starts/), '2099-12-01T12:00');
    await userEvent.type(within(dialog).getByLabelText(/^Ends/), endsAt);
    await userEvent.type(within(dialog).getByRole('spinbutton', { name: 'Capacity' }), capacity);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('does not send a title made only of spaces', async () => {
    const { calls } = mockHttp([signedIn, sessions]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Add session' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add session' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), '   ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findAllByText('Required')).not.toHaveLength(0);
    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('deletes a session only after confirmation', async () => {
    const { calls } = mockHttp([
      signedIn,
      { method: 'get', url: '/sessions', status: 200, body: [{ ...session, confirmedCount: 0 }] },
      { method: 'delete', url: '/sessions/s1', status: 204 },
      { method: 'get', url: '/sessions', status: 200, body: [] },
    ]);
    renderSessions();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete State of React' }));
    expect(calls.some((call) => call.method === 'delete')).toBe(false);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'delete' && call.url === '/sessions/s1')).toBe(
        true,
      );
    });
  });
});
