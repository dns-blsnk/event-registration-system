import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockHttp, type MockRoute } from '@/test/http-mock';
import { renderAdminPage } from '@/test/render-admin';

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
