import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent, createRegistration, createSession } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const DAY_MS = 86_400_000;

describe('event actions', () => {
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

  function post(actor: SignedInAgent, path: string): ReturnType<SignedInAgent['agent']['post']> {
    return actor.agent.post(path).set('x-csrf-token', actor.csrfToken);
  }

  describe('POST /api/events/:id/publish', () => {
    it('publishes a draft that has a session', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId, status: 'DRAFT' });
      await createSession(prisma, event);

      const response = await post(organizer, `/api/events/${event.id}/publish`).expect(200);

      expect(response.body.status).toBe('PUBLISHED');
    });

    it('refuses a draft without sessions', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId, status: 'DRAFT' });

      const response = await post(organizer, `/api/events/${event.id}/publish`).expect(409);

      expect(response.body.message).toBe('Add at least one session before publishing the event');
    });

    it('refuses an event that has already started', async () => {
      const startsAt = new Date(Date.now() - DAY_MS);
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        status: 'DRAFT',
        startsAt,
        endsAt: new Date(Date.now() + DAY_MS),
      });
      await createSession(prisma, event);

      const response = await post(organizer, `/api/events/${event.id}/publish`).expect(409);

      expect(response.body.code).toBe('INVALID_TRANSITION');
    });

    it('refuses to publish twice', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        status: 'PUBLISHED',
      });

      const response = await post(organizer, `/api/events/${event.id}/publish`).expect(409);

      expect(response.body.code).toBe('INVALID_TRANSITION');
    });

    it("answers 404 for another organizer's event", async () => {
      const event = await createEvent(prisma, {
        organizerId: otherOrganizer.userId,
        status: 'DRAFT',
      });
      await createSession(prisma, event);

      await post(organizer, `/api/events/${event.id}/publish`).expect(404);

      expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(
        'DRAFT',
      );
    });
  });

  describe('POST /api/events/:id/cancel', () => {
    it('cancels the event and every active registration, freeing all seats', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event, { capacity: 2, confirmedCount: 2 });
      const confirmed = await createRegistration(prisma, session, { status: 'CONFIRMED' });
      const waitlisted = await createRegistration(prisma, session, { status: 'WAITLISTED' });
      const attendedEarlier = await createRegistration(prisma, session, { status: 'ATTENDED' });

      const response = await post(organizer, `/api/events/${event.id}/cancel`).expect(200);

      expect(response.body.status).toBe('CANCELLED');
      const statusOf = async (id: string): Promise<{ status: string; cancelledAt: Date | null }> =>
        prisma.registration.findUniqueOrThrow({
          where: { id },
          select: { status: true, cancelledAt: true },
        });
      expect(await statusOf(confirmed.id)).toMatchObject({
        status: 'CANCELLED',
        cancelledAt: expect.any(Date),
      });
      expect(await statusOf(waitlisted.id)).toMatchObject({ status: 'CANCELLED' });
      expect(await statusOf(attendedEarlier.id)).toMatchObject({
        status: 'ATTENDED',
        cancelledAt: null,
      });
      // The attendee keeps their seat; the cancelled confirmed seat is freed.
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).confirmedCount,
      ).toBe(1);
    });

    it('cancels a draft', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId, status: 'DRAFT' });

      const response = await post(organizer, `/api/events/${event.id}/cancel`).expect(200);

      expect(response.body.status).toBe('CANCELLED');
    });

    it('refuses to cancel an event that has already ended', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - 2 * DAY_MS),
        endsAt: new Date(Date.now() - DAY_MS),
      });

      const response = await post(organizer, `/api/events/${event.id}/cancel`).expect(409);

      expect(response.body.message).toBe('An event that has already ended cannot be cancelled');
    });

    it('refuses to cancel a completed event', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        status: 'COMPLETED',
      });

      await post(organizer, `/api/events/${event.id}/cancel`).expect(409);
    });

    it("answers 404 for another organizer's event and leaves its bookings alone", async () => {
      const event = await createEvent(prisma, { organizerId: otherOrganizer.userId });
      const registration = await createRegistration(prisma, await createSession(prisma, event));

      await post(organizer, `/api/events/${event.id}/cancel`).expect(404);

      expect(
        (await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status,
      ).toBe('CONFIRMED');
    });
  });

  describe('POST /api/events/:id/complete', () => {
    it('completes a published event that has started', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - DAY_MS),
        endsAt: new Date(Date.now() + DAY_MS),
      });

      const response = await post(organizer, `/api/events/${event.id}/complete`).expect(200);

      expect(response.body.status).toBe('COMPLETED');
    });

    it('refuses to complete a draft', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        status: 'DRAFT',
        startsAt: new Date(Date.now() - DAY_MS),
        endsAt: new Date(Date.now() + DAY_MS),
      });

      await post(organizer, `/api/events/${event.id}/complete`).expect(409);
    });

    it("answers 404 when completing another organizer's event", async () => {
      const event = await createEvent(prisma, {
        organizerId: otherOrganizer.userId,
        startsAt: new Date(Date.now() - DAY_MS),
        endsAt: new Date(Date.now() + DAY_MS),
      });

      await post(organizer, `/api/events/${event.id}/complete`).expect(404);
    });

    it('refuses to complete an event before it starts', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });

      const response = await post(organizer, `/api/events/${event.id}/complete`).expect(409);

      expect(response.body.message).toBe('An event cannot be completed before it starts');
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('lets an admin delete an event nobody registered for', async () => {
      const event = await createEvent(prisma);
      await createSession(prisma, event);

      await admin.agent
        .delete(`/api/events/${event.id}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(204);

      expect(await prisma.event.count({ where: { id: event.id } })).toBe(0);
    });

    it('refuses to delete an event with registrations', async () => {
      const event = await createEvent(prisma);
      await createRegistration(prisma, await createSession(prisma, event));

      const response = await admin.agent
        .delete(`/api/events/${event.id}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(409);

      expect(response.body.message).toBe(
        'Events with registrations cannot be deleted. Cancel the event instead.',
      );
    });

    it('is closed to organizers, even for their own events', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });

      await organizer.agent
        .delete(`/api/events/${event.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .expect(403);
    });

    it('answers 404 for an unknown event', async () => {
      await admin.agent
        .delete(`/api/events/${randomUUID()}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(404);
    });
  });

  it("lets an admin publish any organizer's event", async () => {
    const event = await createEvent(prisma, {
      organizerId: otherOrganizer.userId,
      status: 'DRAFT',
    });
    await createSession(prisma, event);

    await post(admin, `/api/events/${event.id}/publish`).expect(200);
  });

  it.each(['publish', 'cancel', 'complete'])('closes %s to customers', async (action) => {
    const customer = await signedInAgent(app, 'CUSTOMER');
    const event = await createEvent(prisma);

    await post(customer, `/api/events/${event.id}/${action}`).expect(403);
  });
});
