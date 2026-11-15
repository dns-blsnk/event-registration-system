import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent, createRegistration, createSession } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const DAY_MS = 86_400_000;

describe('catalog API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: SignedInAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    customer = await signedInAgent(app, 'CUSTOMER');
  });

  afterAll(async () => {
    await app.close();
  });

  function marker(): string {
    return `Catalog ${randomUUID().slice(0, 8)}`;
  }

  it('lists only published events that have not ended, with seats left in upcoming sessions', async () => {
    const title = marker();
    const visible = await createEvent(prisma, { title });
    await createSession(prisma, visible, { capacity: 10, confirmedCount: 4 });
    await createSession(prisma, visible, { capacity: 5, confirmedCount: 5 });
    await createEvent(prisma, { title, status: 'DRAFT' });
    await createEvent(prisma, { title, status: 'CANCELLED' });
    await createEvent(prisma, {
      title,
      startsAt: new Date(Date.now() - 3 * DAY_MS),
      endsAt: new Date(Date.now() - DAY_MS),
    });

    const response = await customer.agent.get('/api/catalog').query({ q: title }).expect(200);

    expect(response.headers['x-total-count']).toBe('1');
    expect(response.body).toEqual([
      expect.objectContaining({ id: visible.id, title, upcomingSessionsCount: 2, seatsLeft: 6 }),
    ]);
    expect(response.body[0]).not.toHaveProperty('organizerId');
  });

  it('keeps a running event visible but counts only sessions that have not started', async () => {
    const title = marker();
    const running = await createEvent(prisma, {
      title,
      startsAt: new Date(Date.now() - DAY_MS),
      endsAt: new Date(Date.now() + DAY_MS),
    });
    await createSession(prisma, running, {
      capacity: 50,
      startsAt: new Date(Date.now() - DAY_MS / 2),
    });
    await createSession(prisma, running, {
      capacity: 5,
      startsAt: new Date(Date.now() + DAY_MS / 2),
    });

    const response = await customer.agent.get('/api/catalog').query({ q: title }).expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: running.id, upcomingSessionsCount: 1, seatsLeft: 5 }),
    ]);
  });

  it('filters by tag and by start date range', async () => {
    const title = marker();
    const tag = await prisma.tag.create({ data: { name: title } });
    const tagged = await createEvent(prisma, {
      title,
      startsAt: new Date(Date.now() + 10 * DAY_MS),
    });
    await prisma.eventTag.create({ data: { eventId: tagged.id, tagId: tag.id } });
    await createEvent(prisma, { title, startsAt: new Date(Date.now() + 20 * DAY_MS) });

    const byTag = await customer.agent
      .get('/api/catalog')
      .query({ q: title, tagId: tag.id })
      .expect(200);
    const byDate = await customer.agent
      .get('/api/catalog')
      .query({
        q: title,
        startsFrom: new Date(Date.now() + 9 * DAY_MS).toISOString(),
        startsTo: new Date(Date.now() + 11 * DAY_MS).toISOString(),
      })
      .expect(200);

    expect(byTag.body.map((event: { id: string }) => event.id)).toEqual([tagged.id]);
    expect(byDate.body.map((event: { id: string }) => event.id)).toEqual([tagged.id]);
  });

  it('sorts by title', async () => {
    const title = marker();
    const beta = await createEvent(prisma, { title: `${title} Beta` });
    const alpha = await createEvent(prisma, { title: `${title} Alpha` });

    const response = await customer.agent
      .get('/api/catalog')
      .query({ q: title, _sort: 'title', _order: 'asc' })
      .expect(200);

    expect(response.body.map((event: { id: string }) => event.id)).toEqual([alpha.id, beta.id]);
  });

  it.each([
    ['a tag id that is not a uuid', { tagId: 'nope' }],
    ['a date that cannot be read', { startsFrom: 'someday' }],
    ['a field it cannot sort by', { _sort: 'organizerId' }],
  ])('answers 400 for %s', async (_case, query) => {
    const response = await customer.agent.get('/api/catalog').query(query).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('filters by city and sorts by start', async () => {
    const title = marker();
    const later = await createEvent(prisma, {
      title,
      city: 'Lviv',
      startsAt: new Date(Date.now() + 9 * DAY_MS),
    });
    const sooner = await createEvent(prisma, {
      title,
      city: 'Lviv',
      startsAt: new Date(Date.now() + 8 * DAY_MS),
    });
    await createEvent(prisma, { title, city: 'Odesa' });

    const response = await customer.agent
      .get('/api/catalog')
      .query({ q: title, city: 'lviv', _sort: 'startsAt', _order: 'asc' })
      .expect(200);

    expect(response.body.map((event: { id: string }) => event.id)).toEqual([sooner.id, later.id]);
  });

  it('shows an event with its sessions in order and the viewer’s own booking only', async () => {
    const event = await createEvent(prisma, { title: marker() });
    const second = await createSession(prisma, event, {
      title: 'Second',
      startsAt: new Date(event.startsAt.getTime() + DAY_MS),
    });
    const first = await createSession(prisma, event, {
      title: 'First',
      capacity: 3,
      confirmedCount: 1,
    });
    const mine = await createRegistration(prisma, first, {
      customerId: customer.userId,
      status: 'CONFIRMED',
    });
    await createRegistration(prisma, second);

    const response = await customer.agent.get(`/api/catalog/${event.id}`).expect(200);

    expect(response.body).toMatchObject({
      id: event.id,
      description: event.description,
      bannerUrl: null,
    });
    expect(response.body.sessions).toEqual([
      expect.objectContaining({
        id: first.id,
        seatsLeft: 2,
        fillRate: 1 / 3,
        isUpcoming: true,
        myRegistration: { id: mine.id, status: 'CONFIRMED' },
      }),
      expect.objectContaining({ id: second.id, myRegistration: null }),
    ]);
  });

  it('marks a session that has started as no longer upcoming', async () => {
    const event = await createEvent(prisma, {
      startsAt: new Date(Date.now() - DAY_MS),
      endsAt: new Date(Date.now() + DAY_MS),
    });
    await createSession(prisma, event, { startsAt: new Date(Date.now() - DAY_MS / 2) });

    const response = await customer.agent.get(`/api/catalog/${event.id}`).expect(200);

    expect(response.body.sessions).toEqual([expect.objectContaining({ isUpcoming: false })]);
  });

  it.each(['DRAFT', 'CANCELLED', 'COMPLETED'] as const)(
    'answers 404 for a %s event, like for a missing one',
    async (status) => {
      const event = await createEvent(prisma, { status });

      const response = await customer.agent.get(`/api/catalog/${event.id}`).expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    },
  );

  it('answers 400 for an id that is not a uuid', async () => {
    await customer.agent.get('/api/catalog/not-a-uuid').expect(400);
  });

  it.each(['ADMIN', 'ORGANIZER'] as const)('refuses the catalog to %s', async (role) => {
    const staff = await signedInAgent(app, role);

    await staff.agent.get('/api/catalog').expect(403);
  });

  it('refuses the catalog without a session', async () => {
    const { default: request } = await import('supertest');

    await request(app.getHttpServer()).get('/api/catalog').expect(401);
  });
});
