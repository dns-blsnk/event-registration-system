import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '../../test/http-mock';
import { renderAdminPage } from '../../test/render-admin';

import { AppLogList } from './app-log-list';
import { AppLogShow } from './app-log-show';

import type { AppLogDetail } from '@ers/shared';

const signedIn: MockRoute = {
  method: 'get',
  url: '/auth/session',
  status: 200,
  body: {
    user: { id: 'a1', email: 'admin@demo.test', name: 'Ada', role: 'ADMIN' },
    csrfToken: 't',
  },
};

const entry: AppLogDetail = {
  id: 'l1',
  createdAt: '2026-11-14T10:00:00Z',
  level: 'ERROR',
  category: 'ERROR',
  requestId: 'req-123',
  method: 'POST',
  route: '/api/registrations',
  statusCode: 500,
  errorCode: 'INTERNAL_ERROR',
  message: 'Database timeout',
  userId: 'u1',
  userRole: 'CUSTOMER',
  durationMs: 1200,
  stack: 'Error: Database timeout\n    at book (booking.service.ts:42)',
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
  context: { sessionId: 's1' },
};

function lastQuery(calls: { url?: string }[]): Record<string, string> {
  const last = calls.filter((call) => call.url?.startsWith('/app-logs')).at(-1);
  return Object.fromEntries(new URL(String(last?.url), 'http://admin.test').searchParams);
}

describe('AppLogList', () => {
  it('shows entries newest first with level, category, status, route and message', async () => {
    const { calls } = mockHttp([
      signedIn,
      { method: 'get', url: '/app-logs', status: 200, body: [entry] },
    ]);
    renderAdminPage({ path: '/logs', route: '/logs', element: <AppLogList /> });

    expect(await screen.findByText('Database timeout')).toBeInTheDocument();
    expect(screen.getByText('/api/registrations')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(lastQuery(calls)).toMatchObject({ _sort: 'createdAt', _order: 'desc' });
  });

  it('opens an entry from its message', async () => {
    mockHttp([signedIn, { method: 'get', url: '/app-logs', status: 200, body: [entry] }]);
    renderAdminPage({ path: '/logs', route: '/logs', element: <AppLogList /> });

    expect(await screen.findByRole('link', { name: 'Database timeout' })).toHaveAttribute(
      'href',
      '/logs/l1',
    );
  });

  it('finds the entry behind an error by its request id', async () => {
    const list: MockRoute = { method: 'get', url: '/app-logs', status: 200, body: [entry] };
    const { calls } = mockHttp([signedIn, list, list]);
    renderAdminPage({ path: '/logs', route: '/logs', element: <AppLogList /> });
    await screen.findByText('Database timeout');

    await userEvent.type(screen.getByRole('textbox', { name: 'Request id' }), ' req-123 {Enter}');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ requestId: 'req-123', _start: '0' });
    });
  });

  it('searches the message and route on the server', async () => {
    const list: MockRoute = { method: 'get', url: '/app-logs', status: 200, body: [entry] };
    const { calls } = mockHttp([signedIn, list, list]);
    renderAdminPage({ path: '/logs', route: '/logs', element: <AppLogList /> });
    await screen.findByText('Database timeout');

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'timeout{Enter}');

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ q: 'timeout' });
    });
  });

  it('filters by level on the server', async () => {
    const list: MockRoute = { method: 'get', url: '/app-logs', status: 200, body: [entry] };
    const { calls } = mockHttp([signedIn, list, list]);
    renderAdminPage({ path: '/logs', route: '/logs', element: <AppLogList /> });
    await screen.findByText('Database timeout');

    await userEvent.click(screen.getByRole('combobox', { name: 'Level' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Warn' }));

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ level: 'WARN' });
    });
  });

  it('filters by category on the server', async () => {
    const list: MockRoute = { method: 'get', url: '/app-logs', status: 200, body: [entry] };
    const { calls } = mockHttp([signedIn, list, list]);
    renderAdminPage({ path: '/logs', route: '/logs', element: <AppLogList /> });
    await screen.findByText('Database timeout');

    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Security' }));

    await waitFor(() => {
      expect(lastQuery(calls)).toMatchObject({ category: 'SECURITY' });
    });
  });
});

describe('AppLogShow', () => {
  it('shows everything recorded for an entry, including stack and context', async () => {
    mockHttp([signedIn, { method: 'get', url: '/app-logs/l1', status: 200, body: entry }]);
    renderAdminPage({ path: '/logs/l1', route: '/logs/:id', element: <AppLogShow /> });

    expect(await screen.findByText('Database timeout')).toBeInTheDocument();
    expect(screen.getByText('req-123')).toBeInTheDocument();
    expect(screen.getByText('u1 (Customer)')).toBeInTheDocument();
    expect(screen.getByText('1200 ms')).toBeInTheDocument();
    expect(screen.getByText(/at book \(booking\.service\.ts:42\)/)).toBeInTheDocument();
    expect(screen.getByText(/"sessionId": "s1"/)).toBeInTheDocument();
  });

  it('marks fields that were not recorded and leaves out an empty stack', async () => {
    const security: AppLogDetail = {
      ...entry,
      level: 'WARN',
      category: 'SECURITY',
      statusCode: null,
      userId: null,
      userRole: null,
      stack: null,
      context: null,
    };
    mockHttp([signedIn, { method: 'get', url: '/app-logs/l1', status: 200, body: security }]);
    renderAdminPage({ path: '/logs/l1', route: '/logs/:id', element: <AppLogShow /> });

    expect(await screen.findByText('Security')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('Stack')).not.toBeInTheDocument();
  });

  it('explains when the entry cannot be loaded', async () => {
    mockHttp([
      signedIn,
      { method: 'get', url: '/app-logs/l1', status: 404, body: { message: 'Not found' } },
    ]);
    renderAdminPage({ path: '/logs/l1', route: '/logs/:id', element: <AppLogShow /> });

    expect(await screen.findByText('This entry could not be loaded.')).toBeInTheDocument();
  });
});
