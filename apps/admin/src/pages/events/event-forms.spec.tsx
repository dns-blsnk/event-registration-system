import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { EventCreate } from './event-create';
import { EventEdit } from './event-edit';

import type { EventDetail } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: { user: { id: 'o1', email: 'o@demo.test', name: 'O', role: 'ORGANIZER' }, csrfToken: 't' },
};

const tags: MockRoute = {
  method: 'get',
  url: '/tags',
  status: 200,
  body: [{ id: 't1', name: 'AI', eventCount: 1 }],
};

const event: EventDetail = {
  id: 'e1',
  title: 'Kyiv Frontend Summit',
  slug: 'kyiv-frontend-summit',
  city: 'Kyiv',
  venue: 'Main Hall',
  startsAt: '2099-12-01T09:00:00.000Z',
  endsAt: '2099-12-02T18:00:00.000Z',
  status: 'DRAFT',
  organizer: { id: 'o1', name: 'Olena' },
  tags: [{ id: 't1', name: 'AI' }],
  sessionsCount: 0,
  capacity: 0,
  confirmedCount: 0,
  fillRate: 0,
  description: 'Two days of talks.',
  bannerUrl: null,
  createdAt: '2099-10-01T09:00:00.000Z',
  updatedAt: '2099-10-01T09:00:00.000Z',
};

function bodyOf(call: { data?: unknown } | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.data)) as Record<string, unknown>;
}

describe('EventCreate', () => {
  it('sends ISO dates and tag ids to the API', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'post', url: '/events', status: 201, body: event },
    ]);
    renderAdminPage({ path: '/events/create', route: '/events/create', element: <EventCreate /> });

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Title' }),
      'Kyiv Frontend Summit',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Two days of talks.',
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'City' }), 'Kyiv');
    await userEvent.type(screen.getByRole('textbox', { name: 'Venue' }), 'Main Hall');
    await userEvent.type(screen.getByLabelText(/^Starts/), '2099-12-01T11:00');
    await userEvent.type(screen.getByLabelText(/^Ends/), '2099-12-02T20:00');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'post' && call.url === '/events')).toBe(true);
    });
    const body = bodyOf(calls.find((call) => call.method === 'post'));
    expect(body).toMatchObject({ title: 'Kyiv Frontend Summit', city: 'Kyiv', tagIds: [] });
    expect(body.startsAt).toBe(new Date('2099-12-01T11:00').toISOString());
  });

  it('shows the field error the API returns', async () => {
    mockHttp([
      signedIn,
      tags,
      {
        method: 'post',
        url: '/events',
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Invalid',
          details: [{ field: 'startsAt', messages: ['The event must start in the future'] }],
          requestId: 'r',
        },
      },
    ]);
    renderAdminPage({ path: '/events/create', route: '/events/create', element: <EventCreate /> });

    await userEvent.type(await screen.findByRole('textbox', { name: 'Title' }), 'T');
    await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), 'D');
    await userEvent.type(screen.getByRole('textbox', { name: 'City' }), 'C');
    await userEvent.type(screen.getByRole('textbox', { name: 'Venue' }), 'V');
    await userEvent.type(screen.getByLabelText(/^Starts/), '2000-01-01T10:00');
    await userEvent.type(screen.getByLabelText(/^Ends/), '2000-01-01T12:00');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('The event must start in the future')).toBeInTheDocument();
  });

  it('does not send a form with empty required fields', async () => {
    const { calls } = mockHttp([signedIn, tags]);
    renderAdminPage({ path: '/events/create', route: '/events/create', element: <EventCreate /> });

    await userEvent.click(await screen.findByRole('button', { name: /save/i }));

    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });
});

describe('EventEdit', () => {
  it('loads the event into the form and saves changes as a PATCH', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: event },
      { method: 'patch', url: '/events/e1', status: 200, body: { ...event, title: 'Renamed' } },
    ]);
    renderAdminPage({ path: '/events/e1/edit', route: '/events/:id/edit', element: <EventEdit /> });

    const title = await screen.findByDisplayValue('Kyiv Frontend Summit');
    await userEvent.clear(title);
    await userEvent.type(title, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'patch')).toBe(true);
    });
    // Only the changed field: untouched dates are never re-sent, so they cannot lose their seconds.
    expect(bodyOf(calls.find((call) => call.method === 'patch'))).toEqual({ title: 'Renamed' });
  });

  it('shows completed events as read-only', async () => {
    mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: { ...event, status: 'COMPLETED' } },
    ]);
    renderAdminPage({ path: '/events/e1/edit', route: '/events/:id/edit', element: <EventEdit /> });

    expect(await screen.findByText(/can no longer be changed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.queryByLabelText('Banner image')).not.toBeInTheDocument();
  });

  it('refuses a file that is not a supported image before uploading it', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: event },
    ]);
    renderAdminPage({ path: '/events/e1/edit', route: '/events/:id/edit', element: <EventEdit /> });
    await screen.findByDisplayValue('Kyiv Frontend Summit');

    await userEvent.upload(
      screen.getByLabelText('Banner image'),
      new File(['%PDF'], 'banner.pdf', { type: 'application/pdf' }),
      {
        applyAccept: false,
      },
    );

    expect(calls.some((call) => call.method === 'put')).toBe(false);
  });

  it('keeps unsaved edits when a banner is uploaded', async () => {
    mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: event },
      { method: 'put', url: '/events/e1/banner', status: 204 },
    ]);
    renderAdminPage({ path: '/events/e1/edit', route: '/events/:id/edit', element: <EventEdit /> });
    const title = await screen.findByDisplayValue('Kyiv Frontend Summit');
    await userEvent.clear(title);
    await userEvent.type(title, 'Unsaved title');

    await userEvent.upload(
      screen.getByLabelText('Banner image'),
      new File(['png'], 'banner.png', { type: 'image/png' }),
    );

    expect(await screen.findByRole('button', { name: 'Replace banner' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Unsaved title')).toBeInTheDocument();
  });

  it('uploads a banner as multipart form data', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: event },
      { method: 'put', url: '/events/e1/banner', status: 204 },
      {
        method: 'get',
        url: '/events/e1',
        status: 200,
        body: { ...event, bannerUrl: 'https://files.test/b.png' },
      },
    ]);
    renderAdminPage({ path: '/events/e1/edit', route: '/events/:id/edit', element: <EventEdit /> });
    await screen.findByDisplayValue('Kyiv Frontend Summit');

    await userEvent.upload(
      screen.getByLabelText('Banner image'),
      new File(['png'], 'banner.png', { type: 'image/png' }),
    );

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'put' && call.url === '/events/e1/banner')).toBe(
        true,
      );
    });
    expect(calls.find((call) => call.method === 'put')?.data).toBeInstanceOf(FormData);
  });

  it('refuses an oversized banner before uploading it', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: event },
    ]);
    renderAdminPage({ path: '/events/e1/edit', route: '/events/:id/edit', element: <EventEdit /> });
    await screen.findByDisplayValue('Kyiv Frontend Summit');
    const huge = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' });

    await userEvent.upload(screen.getByLabelText('Banner image'), huge);

    expect(calls.some((call) => call.method === 'put')).toBe(false);
  });
});
