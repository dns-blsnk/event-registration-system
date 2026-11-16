import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickBanner } from '@/test/banner';
import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { EventCreate } from './event-create';

import type { EventDetail } from '@ers/shared';

vi.mock('react-easy-crop', async () => ({ default: (await import('@/test/banner')).FakeCropper }));
vi.mock('@/features/event-form/lib/read-image', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  imageSizeOf: (await import('@/test/banner-mocks')).BANNER_MOCKS.imageSizeOf,
}));
vi.mock('@/features/event-form/lib/crop-banner', async () => ({
  cropBanner: (await import('@/test/banner-mocks')).BANNER_MOCKS.cropBanner,
}));

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

async function fillDetails(startsAt = '2099-12-01T11:00', endsAt = '2099-12-02T20:00') {
  await userEvent.type(
    await screen.findByRole('textbox', { name: 'Title' }),
    'Kyiv Frontend Summit',
  );
  await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), 'Two days of talks.');
  await userEvent.type(screen.getByRole('textbox', { name: 'City' }), 'Kyiv');
  await userEvent.type(screen.getByRole('textbox', { name: 'Venue' }), 'Main Hall');
  await userEvent.type(screen.getByLabelText(/^Starts/), startsAt);
  await userEvent.type(screen.getByLabelText(/^Ends/), endsAt);
}

function renderCreate(): void {
  renderAdminPage({ path: '/events/create', route: '/events/create', element: <EventCreate /> });
}

describe('EventCreate', () => {
  it('saves the event, then its banner, with ISO dates and tag ids', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'post', url: '/events', status: 201, body: event },
      { method: 'put', url: '/events/e1/banner', status: 204 },
    ]);
    renderCreate();

    await fillDetails();
    await pickBanner();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'put')).toBe(true);
    });
    const writes = calls.filter((call) => call.method !== 'get');
    expect(writes.map((call) => `${String(call.method)} ${String(call.url)}`)).toEqual([
      'post /events',
      'put /events/e1/banner',
    ]);
    expect(writes[1]?.data).toBeInstanceOf(FormData);
    const body = bodyOf(writes[0]);
    expect(body).toMatchObject({ title: 'Kyiv Frontend Summit', city: 'Kyiv', tagIds: [] });
    expect(body.startsAt).toBe(new Date('2099-12-01T11:00').toISOString());
  });

  it('refuses to create an event without a banner', async () => {
    const { calls } = mockHttp([signedIn, tags]);
    renderCreate();

    await fillDetails();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/^Add a banner/)).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });

  it('says the event is saved when only its banner fails', async () => {
    mockHttp([
      signedIn,
      tags,
      { method: 'post', url: '/events', status: 201, body: event },
      {
        method: 'put',
        url: '/events/e1/banner',
        status: 415,
        body: {
          statusCode: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Bad image',
          requestId: 'r',
        },
      },
    ]);
    renderCreate();

    await fillDetails();
    await pickBanner();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(
      await screen.findByText('The event is saved, but its banner is not'),
    ).toBeInTheDocument();
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
    renderCreate();

    await fillDetails('2000-01-01T10:00', '2000-01-01T12:00');
    await pickBanner();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('The event must start in the future')).toBeInTheDocument();
  });

  it('does not send a form with empty required fields, and asks for the banner too', async () => {
    const { calls } = mockHttp([signedIn, tags]);
    renderCreate();

    await userEvent.click(await screen.findByRole('button', { name: /save/i }));

    expect(await screen.findByText(/^Add a banner/)).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'post')).toBe(false);
  });
});
