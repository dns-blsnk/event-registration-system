import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent, createSession, createUser } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function futureRange(daysAhead: number, lengthDays = 1): { startsAt: string; endsAt: string } {
  const start = new Date(Date.now() + daysAhead * DAY_MS);
  return {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + lengthDays * DAY_MS).toISOString(),
  };
}

function newEventBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Frontend Summit',
    description: 'Talks about the web',
    venue: 'Main Hall',
    city: 'Lviv',
    ...futureRange(10),
    ...overrides,
  };
}

describe('events API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: SignedInAgent;
  let organizer: SignedInAgent;
  let otherOrganizer: SignedInAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await signedInAgent(app, 'ADMIN');
    organizer = await signedInAgent(app, 'ORGANIZER');
    otherOrganizer = await signedInAgent(app, 'ORGANIZER');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/events', () => {
    it('shows organizers only their own events and admins everything', async () => {
      const marker = randomUUID().slice(0, 8);
      await createEvent(prisma, { title: `Own ${marker}`, organizerId: organizer.userId });
      await createEvent(prisma, { title: `Other ${marker}`, organizerId: otherOrganizer.userId });

      const asOrganizer = await organizer.agent.get('/api/events').query({ q: marker }).expect(200);
      const asAdmin = await admin.agent.get('/api/events').query({ q: marker }).expect(200);

      expect(asOrganizer.body.map((event: { title: string }) => event.title)).toEqual([
        `Own ${marker}`,
      ]);
      expect(asOrganizer.headers['x-total-count']).toBe('1');
      expect(asAdmin.headers['x-total-count']).toBe('2');
    });

    it('ignores an organizerId filter that would reach another organizer', async () => {
      const marker = randomUUID().slice(0, 8);
      await createEvent(prisma, { title: `Hidden ${marker}`, organizerId: otherOrganizer.userId });

      const response = await organizer.agent
        .get('/api/events')
        .query({ q: marker, organizerId: otherOrganizer.userId })
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('reports seat statistics across sessions', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        title: `Stats ${randomUUID()}`,
      });
      await createSession(prisma, event, { capacity: 10, confirmedCount: 5 });
      await createSession(prisma, event, {
        capacity: 30,
        confirmedCount: 25,
        startsAt: new Date(event.startsAt.getTime() + 2 * HOUR_MS),
      });

      const response = await organizer.agent.get(`/api/events/${event.id}`).expect(200);

      expect(response.body).toMatchObject({
        sessionsCount: 2,
        capacity: 40,
        confirmedCount: 30,
        fillRate: 0.75,
      });
    });

    it.each([
      ['status', { status: 'CANCELLED' }],
      ['city, ignoring case', { city: 'odesa' }],
    ])('filters by %s', async (_label, filter) => {
      const marker = randomUUID().slice(0, 8);
      await createEvent(prisma, { title: `Match ${marker}`, status: 'CANCELLED', city: 'Odesa' });
      await createEvent(prisma, { title: `Skip ${marker}`, status: 'PUBLISHED', city: 'Kyiv' });

      const response = await admin.agent
        .get('/api/events')
        .query({ q: marker, ...filter })
        .expect(200);

      expect(response.body.map((event: { title: string }) => event.title)).toEqual([
        `Match ${marker}`,
      ]);
    });

    it('filters by tag', async () => {
      const marker = randomUUID().slice(0, 8);
      const tag = await prisma.tag.create({ data: { name: `tag-${marker}` } });
      const tagged = await createEvent(prisma, { title: `Tagged ${marker}` });
      await prisma.eventTag.create({ data: { eventId: tagged.id, tagId: tag.id } });
      await createEvent(prisma, { title: `Plain ${marker}` });

      const response = await admin.agent
        .get('/api/events')
        .query({ q: marker, tagId: tag.id })
        .expect(200);

      expect(response.body.map((event: { title: string }) => event.title)).toEqual([
        `Tagged ${marker}`,
      ]);
      expect(response.body[0].tags).toEqual([{ id: tag.id, name: tag.name }]);
    });

    it('filters by a start date range', async () => {
      const marker = randomUUID().slice(0, 8);
      const soon = new Date(Date.now() + 3 * DAY_MS);
      const later = new Date(Date.now() + 30 * DAY_MS);
      await createEvent(prisma, { title: `Soon ${marker}`, startsAt: soon });
      await createEvent(prisma, { title: `Later ${marker}`, startsAt: later });

      const response = await admin.agent
        .get('/api/events')
        .query({ q: marker, startsFrom: new Date(Date.now() + 10 * DAY_MS).toISOString() })
        .expect(200);

      expect(response.body.map((event: { title: string }) => event.title)).toEqual([
        `Later ${marker}`,
      ]);
    });

    it.each([
      [{ status: 'ARCHIVED' }, 'status'],
      [{ tagId: 'nope' }, 'tagId'],
      [{ startsFrom: 'yesterday' }, 'startsFrom'],
      [{ _sort: 'organizerId' }, '_sort'],
    ])('rejects invalid filter %j', async (query, field) => {
      const response = await admin.agent.get('/api/events').query(query).expect(400);

      expect(response.body.details[0].field).toBe(field);
    });

    it('is closed to customers', async () => {
      const customer = await signedInAgent(app, 'CUSTOMER');

      await customer.agent.get('/api/events').expect(403);
    });
  });

  describe('GET /api/events/:id', () => {
    it("answers 404 for another organizer's event, the same as for a missing one", async () => {
      const event = await createEvent(prisma, { organizerId: otherOrganizer.userId });

      await organizer.agent.get(`/api/events/${event.id}`).expect(404);
      await organizer.agent.get(`/api/events/${randomUUID()}`).expect(404);
    });

    it('returns the full event to its organizer', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        description: 'Full text',
      });

      const response = await organizer.agent.get(`/api/events/${event.id}`).expect(200);

      expect(response.body).toMatchObject({
        id: event.id,
        description: 'Full text',
        organizer: { id: organizer.userId },
      });
    });
  });

  describe('POST /api/events', () => {
    it('creates a draft owned by the organizer with a unique slug', async () => {
      const first = await organizer.agent
        .post('/api/events')
        .set('x-csrf-token', organizer.csrfToken)
        .send(newEventBody())
        .expect(201);
      const second = await organizer.agent
        .post('/api/events')
        .set('x-csrf-token', organizer.csrfToken)
        .send(newEventBody())
        .expect(201);

      expect(first.body).toMatchObject({
        status: 'DRAFT',
        organizer: { id: organizer.userId },
        sessionsCount: 0,
      });
      expect(first.body.slug).toMatch(/^frontend-summit-[0-9a-f]{6}$/);
      expect(first.body.slug).not.toBe(second.body.slug);
    });

    it('lets an admin create an event for an organizer', async () => {
      const response = await admin.agent
        .post('/api/events')
        .set('x-csrf-token', admin.csrfToken)
        .send(newEventBody({ organizerId: organizer.userId }))
        .expect(201);

      expect(response.body.organizer.id).toBe(organizer.userId);
    });

    it('attaches existing tags once each', async () => {
      const tag = await prisma.tag.create({ data: { name: `tag-${randomUUID().slice(0, 8)}` } });

      const response = await organizer.agent
        .post('/api/events')
        .set('x-csrf-token', organizer.csrfToken)
        .send(newEventBody({ tagIds: [tag.id, tag.id] }))
        .expect(201);

      expect(response.body.tags).toEqual([{ id: tag.id, name: tag.name }]);
    });

    it.each([
      [
        'an organizer assigning someone else',
        (): Record<string, unknown> => ({ organizerId: otherOrganizer.userId }),
        'organizerId',
      ],
      [
        'an end before the start',
        (): Record<string, unknown> => ({
          ...futureRange(10),
          endsAt: new Date(Date.now() + 9 * DAY_MS).toISOString(),
        }),
        'endsAt',
      ],
      [
        'a start in the past',
        (): Record<string, unknown> => ({
          startsAt: new Date(Date.now() - DAY_MS).toISOString(),
          endsAt: new Date(Date.now() + DAY_MS).toISOString(),
        }),
        'startsAt',
      ],
      ['an unknown tag', (): Record<string, unknown> => ({ tagIds: [randomUUID()] }), 'tagIds'],
      ['a status in the body', (): Record<string, unknown> => ({ status: 'PUBLISHED' }), 'status'],
    ])('rejects %s', async (_label, makeOverride, field) => {
      const response = await organizer.agent
        .post('/api/events')
        .set('x-csrf-token', organizer.csrfToken)
        .send(newEventBody(makeOverride()))
        .expect(400);

      expect(response.body.details[0].field).toBe(field);
    });

    it('rejects an explicit null organizerId', async () => {
      const response = await admin.agent
        .post('/api/events')
        .set('x-csrf-token', admin.csrfToken)
        .send(newEventBody({ organizerId: null }))
        .expect(400);

      expect(response.body.details[0].field).toBe('organizerId');
    });

    it('refuses to assign an event to a customer', async () => {
      const customer = await createUser(prisma, { role: 'CUSTOMER' });

      const response = await admin.agent
        .post('/api/events')
        .set('x-csrf-token', admin.csrfToken)
        .send(newEventBody({ organizerId: customer.id }))
        .expect(400);

      expect(response.body.details[0].field).toBe('organizerId');
    });
  });

  describe('PATCH /api/events/:id', () => {
    it('updates the details of an own event', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });

      const response = await organizer.agent
        .patch(`/api/events/${event.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: 'Renamed', city: 'Dnipro' })
        .expect(200);

      expect(response.body).toMatchObject({ title: 'Renamed', city: 'Dnipro', venue: event.venue });
    });

    it("answers 404 for another organizer's event and leaves it unchanged", async () => {
      const event = await createEvent(prisma, {
        organizerId: otherOrganizer.userId,
        title: 'Theirs',
      });

      await organizer.agent
        .patch(`/api/events/${event.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: 'Mine now' })
        .expect(404);

      expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).title).toBe(
        'Theirs',
      );
    });

    it('refuses to edit a cancelled event', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        status: 'CANCELLED',
      });

      await organizer.agent
        .patch(`/api/events/${event.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: 'X' })
        .expect(409);
    });

    it('refuses new dates that would leave a session outside the event', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      await createSession(prisma, event);

      const response = await organizer.agent
        .patch(`/api/events/${event.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ startsAt: new Date(event.startsAt.getTime() + HOUR_MS * 3).toISOString() })
        .expect(400);

      expect(response.body.details[0].field).toBe('startsAt');
    });

    it.each(['title', 'startsAt', 'tagIds', 'city'])(
      'rejects an explicit null %s instead of storing or wiping it',
      async (field) => {
        const event = await createEvent(prisma, { organizerId: organizer.userId });

        const response = await organizer.agent
          .patch(`/api/events/${event.id}`)
          .set('x-csrf-token', organizer.csrfToken)
          .send({ [field]: null })
          .expect(400);

        expect(response.body.details[0].field).toBe(field);
      },
    );

    it('refuses to move an event into the past', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });

      const response = await organizer.agent
        .patch(`/api/events/${event.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ startsAt: new Date(Date.now() - DAY_MS).toISOString() })
        .expect(400);

      expect(response.body.details[0].field).toBe('startsAt');
    });

    it('replaces the tags', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const oldTag = await prisma.tag.create({ data: { name: `old-${randomUUID().slice(0, 8)}` } });
      const newTag = await prisma.tag.create({ data: { name: `new-${randomUUID().slice(0, 8)}` } });
      await prisma.eventTag.create({ data: { eventId: event.id, tagId: oldTag.id } });

      const response = await organizer.agent
        .patch(`/api/events/${event.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ tagIds: [newTag.id] })
        .expect(200);

      expect(response.body.tags).toEqual([{ id: newTag.id, name: newTag.name }]);
    });
  });
});
