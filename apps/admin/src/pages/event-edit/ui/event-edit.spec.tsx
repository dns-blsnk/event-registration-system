import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickBanner } from '@/test/banner';
import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

import { EventEdit } from './event-edit';

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

function renderEdit(): void {
  renderAdminPage({ path: '/events/e1/edit', route: '/events/:id/edit', element: <EventEdit /> });
}

function writesOf(calls: { method?: string | undefined; url?: string | undefined }[]): string[] {
  return calls
    .filter((call) => call.method !== 'get')
    .map((call) => `${String(call.method)} ${String(call.url)}`);
}

const published: EventDetail = {
  ...event,
  status: 'PUBLISHED',
  bannerUrl: 'https://files.test/current.webp',
};

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

  it('raises the labels of the fields the loaded event fills, so they do not cover the text', async () => {
    mockHttp([signedIn, tags, { method: 'get', url: '/events/e1', status: 200, body: event }]);
    renderEdit();

    await screen.findByDisplayValue('Kyiv Frontend Summit');
    for (const value of ['Kyiv Frontend Summit', 'Two days of talks.', 'Kyiv', 'Main Hall']) {
      const input = screen.getByDisplayValue<HTMLInputElement>(value);
      expect(input.labels?.[0]).toHaveAttribute('data-shrink', 'true');
    }
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
    expect(screen.getByLabelText('Banner')).toBeDisabled();
  });

  it('sends a new banner only on Save, after the details', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: event },
      { method: 'patch', url: '/events/e1', status: 200, body: { ...event, title: 'Renamed' } },
      { method: 'put', url: '/events/e1/banner', status: 204 },
    ]);
    renderEdit();
    const title = await screen.findByDisplayValue('Kyiv Frontend Summit');
    await userEvent.clear(title);
    await userEvent.type(title, 'Renamed');

    await pickBanner();

    expect(writesOf(calls)).toEqual([]);
    expect(screen.getByDisplayValue('Renamed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(writesOf(calls)).toEqual(['patch /events/e1', 'put /events/e1/banner']);
    });
  });

  it('lets a draft drop its banner', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      {
        method: 'get',
        url: '/events/e1',
        status: 200,
        body: { ...event, bannerUrl: 'https://files.test/current.webp' },
      },
      { method: 'patch', url: '/events/e1', status: 200, body: event },
      { method: 'delete', url: '/events/e1/banner', status: 204 },
    ]);
    renderEdit();
    await screen.findByDisplayValue('Kyiv Frontend Summit');

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(writesOf(calls)).toContain('delete /events/e1/banner');
    });
  });

  it('keeps a published event from losing its banner', async () => {
    const { calls } = mockHttp([
      signedIn,
      tags,
      { method: 'get', url: '/events/e1', status: 200, body: published },
    ]);
    renderEdit();
    await screen.findByDisplayValue('Kyiv Frontend Summit');

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/^Add a banner/)).toBeInTheDocument();
    expect(writesOf(calls)).toEqual([]);
  });
});
