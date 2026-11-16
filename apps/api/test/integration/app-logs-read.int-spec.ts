import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { Prisma } from '../../src/generated/prisma/client.js';
import type { INestApplication } from '@nestjs/common';

describe('app logs read API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: SignedInAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await signedInAgent(app, 'ADMIN');
  });

  afterAll(async () => {
    await app.close();
  });

  async function entry(overrides: Partial<Prisma.AppLogCreateInput> = {}) {
    return prisma.appLog.create({
      data: {
        level: 'ERROR',
        category: 'ERROR',
        message: 'Database unavailable',
        requestId: randomUUID(),
        method: 'GET',
        route: '/api/events',
        statusCode: 503,
        errorCode: 'SERVICE_UNAVAILABLE',
        stack: 'Error: connect ECONNREFUSED',
        ip: '203.0.113.7',
        ...overrides,
      },
    });
  }

  it('finds the entry behind an error by its request id, without the stack in the list', async () => {
    const logged = await entry();

    const response = await admin.agent
      .get('/api/app-logs')
      .query({ requestId: logged.requestId })
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: logged.id,
        statusCode: 503,
        errorCode: 'SERVICE_UNAVAILABLE',
        message: 'Database unavailable',
      }),
    ]);
    expect(response.body[0]).not.toHaveProperty('stack');
    expect(response.body[0]).not.toHaveProperty('ip');
  });

  it('shows the full entry with stack and client details', async () => {
    const logged = await entry({ context: { eventId: 'e1' } });

    const response = await admin.agent.get(`/api/app-logs/${logged.id}`).expect(200);

    expect(response.body).toMatchObject({
      id: logged.id,
      stack: 'Error: connect ECONNREFUSED',
      ip: '203.0.113.7',
      context: { eventId: 'e1' },
    });
  });

  it('filters by level, category, status code and dates, newest first', async () => {
    const marker = randomUUID();
    const older = await entry({
      message: `old ${marker}`,
      createdAt: new Date(Date.now() - 60_000),
    });
    const newer = await entry({ message: `new ${marker}` });
    await entry({
      message: `security ${marker}`,
      category: 'SECURITY',
      level: 'WARN',
      statusCode: 403,
    });

    const response = await admin.agent
      .get('/api/app-logs')
      .query({
        q: marker,
        level: 'ERROR',
        category: 'ERROR',
        statusCode: '503',
        from: new Date(Date.now() - 120_000).toISOString(),
      })
      .expect(200);

    expect(response.body.map((row: { id: string }) => row.id)).toEqual([newer.id, older.id]);
    expect(response.headers['x-total-count']).toBe('2');
  });

  it('limits entries to a date range ending on a whole day', async () => {
    const marker = randomUUID();
    const inside = await entry({
      message: `inside ${marker}`,
      createdAt: new Date('2026-11-10T22:00:00Z'),
    });
    await entry({ message: `after ${marker}`, createdAt: new Date('2026-11-11T00:30:00Z') });

    const response = await admin.agent
      .get('/api/app-logs')
      .query({ q: marker, from: '2026-11-10', to: '2026-11-10' })
      .expect(200);

    expect(response.body.map((row: { id: string }) => row.id)).toEqual([inside.id]);
  });

  it('reports a role that no longer exists as unknown', async () => {
    const logged = await entry({ userRole: 'GHOST' });

    const response = await admin.agent.get(`/api/app-logs/${logged.id}`).expect(200);

    expect(response.body.userRole).toBeNull();
  });

  it('searches by route', async () => {
    const route = `/api/unique-${randomUUID()}`;
    const logged = await entry({ route });

    const response = await admin.agent.get('/api/app-logs').query({ q: route }).expect(200);

    expect(response.body.map((row: { id: string }) => row.id)).toEqual([logged.id]);
  });

  it.each([
    ['level', { level: 'DEBUG' }],
    ['category', { category: 'AUDIT' }],
    ['statusCode', { statusCode: '42' }],
    ['from', { from: 'yesterday' }],
    ['to', { to: 'tomorrow' }],
    ['statusCode', { statusCode: '600' }],
    ['statusCode', { statusCode: 'abc' }],
    ['to', { from: '2026-11-14', to: '2026-11-13' }],
  ])('rejects an invalid %s filter', async (field, query) => {
    const response = await admin.agent.get('/api/app-logs').query(query).expect(400);

    expect(response.body.details[0].field).toBe(field);
  });

  it('answers 404 for an unknown entry', async () => {
    await admin.agent.get(`/api/app-logs/${randomUUID()}`).expect(404);
  });

  it.each(['ORGANIZER', 'CUSTOMER'] as const)('is closed to %s', async (role) => {
    const user = await signedInAgent(app, role);
    const logged = await entry();

    await user.agent.get('/api/app-logs').expect(403);
    await user.agent.get(`/api/app-logs/${logged.id}`).expect(403);
  });
});
