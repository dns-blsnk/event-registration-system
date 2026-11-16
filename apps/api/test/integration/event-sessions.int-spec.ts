import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent, createRegistration, createSession } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe('sessions API', () => {
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

  function at(
    event: { startsAt: Date },
    offsetHours: number,
    lengthHours = 1,
  ): { startsAt: string; endsAt: string } {
    const start = new Date(event.startsAt.getTime() + offsetHours * HOUR_MS);
    return {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + lengthHours * HOUR_MS).toISOString(),
    };
  }

  describe('GET /api/sessions', () => {
    it("lists sessions of the organizer's own events only, with seat numbers", async () => {
      const own = await createEvent(prisma, { organizerId: organizer.userId });
      const other = await createEvent(prisma, { organizerId: otherOrganizer.userId });
      const session = await createSession(prisma, own, { capacity: 4, confirmedCount: 1 });
      await createSession(prisma, other);
      await createRegistration(prisma, session, { status: 'WAITLISTED' });

      const response = await organizer.agent
        .get('/api/sessions')
        .query({ eventId: own.id })
        .expect(200);
      const foreign = await organizer.agent
        .get('/api/sessions')
        .query({ eventId: other.id })
        .expect(200);

      expect(response.body).toEqual([
        expect.objectContaining({
          id: session.id,
          eventTitle: own.title,
          capacity: 4,
          confirmedCount: 1,
          seatsLeft: 3,
          fillRate: 0.25,
          waitlistCount: 1,
        }),
      ]);
      expect(foreign.body).toEqual([]);
    });

    it('filters sessions that are almost full', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const full = await createSession(prisma, event, { capacity: 10, confirmedCount: 9 });
      await createSession(prisma, event, {
        capacity: 10,
        confirmedCount: 8,
        startsAt: new Date(event.startsAt.getTime() + 2 * HOUR_MS),
      });

      const response = await organizer.agent
        .get('/api/sessions')
        .query({ eventId: event.id, almostFull: 'true' })
        .expect(200);

      expect(response.body.map((session: { id: string }) => session.id)).toEqual([full.id]);
    });

    it("never shows another organizer's almost-full sessions", async () => {
      const event = await createEvent(prisma, { organizerId: otherOrganizer.userId });
      await createSession(prisma, event, { capacity: 10, confirmedCount: 10 });

      const response = await organizer.agent
        .get('/api/sessions')
        .query({ almostFull: 'true', eventId: event.id })
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('searches by title, speaker and room', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const marker = randomUUID().slice(0, 8);
      await createSession(prisma, event, { speaker: `Speaker ${marker}` });

      const response = await organizer.agent.get('/api/sessions').query({ q: marker }).expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('is closed to customers', async () => {
      const customer = await signedInAgent(app, 'CUSTOMER');

      await customer.agent.get('/api/sessions').expect(403);
    });

    it('accepts only almostFull=true', async () => {
      const response = await organizer.agent
        .get('/api/sessions')
        .query({ almostFull: 'false' })
        .expect(400);

      expect(response.body.details[0].field).toBe('almostFull');
    });
  });

  describe('POST /api/sessions', () => {
    it('adds a session inside the event', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });

      const response = await organizer.agent
        .post('/api/sessions')
        .set('x-csrf-token', organizer.csrfToken)
        .send({ eventId: event.id, title: '  Keynote  ', room: 'A', capacity: 50, ...at(event, 1) })
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Keynote',
        room: 'A',
        speaker: null,
        capacity: 50,
        seatsLeft: 50,
      });
    });

    it.each([
      ['outside the event dates', (event: { startsAt: Date }) => at(event, -2), 'startsAt'],
      [
        'ending before it starts',
        (event: { startsAt: Date }) => ({ ...at(event, 2), endsAt: at(event, 1).startsAt }),
        'endsAt',
      ],
    ])('rejects a session %s', async (_label, times, field) => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });

      const response = await organizer.agent
        .post('/api/sessions')
        .set('x-csrf-token', organizer.csrfToken)
        .send({ eventId: event.id, title: 'Talk', capacity: 10, ...times(event) })
        .expect(400);

      expect(response.body.details[0].field).toBe(field);
    });

    it.each([0, -1, 10_001, 2.5, '50', true])('rejects capacity %p', async (capacity) => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });

      const response = await organizer.agent
        .post('/api/sessions')
        .set('x-csrf-token', organizer.csrfToken)
        .send({ eventId: event.id, title: 'Talk', capacity, ...at(event, 1) })
        .expect(400);

      expect(response.body.details[0].field).toBe('capacity');
    });

    it("answers 404 when adding to another organizer's event", async () => {
      const event = await createEvent(prisma, { organizerId: otherOrganizer.userId });

      await organizer.agent
        .post('/api/sessions')
        .set('x-csrf-token', organizer.csrfToken)
        .send({ eventId: event.id, title: 'Talk', capacity: 10, ...at(event, 1) })
        .expect(404);

      expect(await prisma.session.count({ where: { eventId: event.id } })).toBe(0);
    });

    it('refuses to add sessions to a cancelled event', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        status: 'CANCELLED',
      });

      await organizer.agent
        .post('/api/sessions')
        .set('x-csrf-token', organizer.csrfToken)
        .send({ eventId: event.id, title: 'Talk', capacity: 10, ...at(event, 1) })
        .expect(409);
    });

    it('refuses a session in the past', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - DAY_MS),
        endsAt: new Date(Date.now() + DAY_MS),
      });

      const response = await organizer.agent
        .post('/api/sessions')
        .set('x-csrf-token', organizer.csrfToken)
        .send({ eventId: event.id, title: 'Talk', capacity: 10, ...at(event, 1) })
        .expect(400);

      expect(response.body.details[0].field).toBe('startsAt');
    });
  });

  describe('PATCH /api/sessions/:id', () => {
    it('updates details and capacity', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event, { capacity: 10, confirmedCount: 3 });

      const response = await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: 'Renamed', capacity: 5 })
        .expect(200);

      expect(response.body).toMatchObject({ title: 'Renamed', capacity: 5, seatsLeft: 2 });
    });

    it('refuses a capacity below the confirmed seats', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event, { capacity: 10, confirmedCount: 6 });

      const response = await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ capacity: 5 })
        .expect(400);

      expect(response.body.details[0]).toEqual({
        field: 'capacity',
        messages: ['Capacity cannot be lower than the 6 seats already confirmed'],
      });
    });

    it('refuses to move a session outside its event', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event);

      await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send(at(event, 24 * 5))
        .expect(400);
    });

    it("answers 404 for another organizer's session", async () => {
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: otherOrganizer.userId }),
      );

      await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: 'X' })
        .expect(404);
    });

    it('clears the speaker and room with null', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event, { speaker: 'Alice', room: 'B2' });

      const response = await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ speaker: null, room: null })
        .expect(200);

      expect(response.body).toMatchObject({ speaker: null, room: null });
    });

    it('reports a session running past the event end on endsAt', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event);

      const response = await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ endsAt: new Date(event.endsAt.getTime() + HOUR_MS).toISOString() })
        .expect(400);

      expect(response.body.details[0].field).toBe('endsAt');
    });

    it('refuses any change to a session that has ended', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - DAY_MS),
        endsAt: new Date(Date.now() + DAY_MS),
      });
      const session = await createSession(prisma, event, {
        startsAt: event.startsAt,
        endsAt: new Date(event.startsAt.getTime() + HOUR_MS),
      });

      const response = await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: 'Rewritten history' })
        .expect(409);

      expect(response.body.message).toBe('Sessions that have ended cannot be changed');
    });

    it('allows renaming a running session but not changing its time or capacity', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - HOUR_MS),
        endsAt: new Date(Date.now() + DAY_MS),
      });
      const session = await createSession(prisma, event, {
        startsAt: event.startsAt,
        endsAt: new Date(Date.now() + HOUR_MS),
      });

      await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: 'Live' })
        .expect(200);
      await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ capacity: 99 })
        .expect(409);
    });

    it('rejects an explicit null title', async () => {
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: organizer.userId }),
      );

      await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ title: null })
        .expect(400);
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('deletes a session nobody registered for', async () => {
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: organizer.userId }),
      );

      await organizer.agent
        .delete(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .expect(204);

      expect(await prisma.session.count({ where: { id: session.id } })).toBe(0);
    });

    it('refuses to delete a session with registrations', async () => {
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: organizer.userId }),
      );
      await createRegistration(prisma, session);

      const response = await organizer.agent
        .delete(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .expect(409);

      expect(response.body.message).toBe('Sessions with registrations cannot be deleted');
    });

    it("lets an admin delete any organizer's session", async () => {
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: otherOrganizer.userId }),
      );

      await admin.agent
        .delete(`/api/sessions/${session.id}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(204);
    });
  });
});
