import { BULK_STATUS_MAX_IDS } from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import {
  createEvent,
  createRegistration,
  createSession,
  createUser,
} from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const HOUR_MS = 3_600_000;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('staff registrations API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: SignedInAgent;
  let organizer: SignedInAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await signedInAgent(app, 'ADMIN');
    organizer = await signedInAgent(app, 'ORGANIZER');
  });

  afterAll(async () => {
    await app.close();
  });

  async function bulk(agent: SignedInAgent, body: unknown, expected = 200) {
    return agent.agent
      .post('/api/registrations/bulk-status')
      .set('x-csrf-token', agent.csrfToken)
      .send(body as object)
      .expect(expected);
  }

  async function statusOf(id: string): Promise<string> {
    return (await prisma.registration.findUniqueOrThrow({ where: { id } })).status;
  }

  describe('GET /api/registrations', () => {
    it('shows an organizer the bookings of their own events with customer details', async () => {
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event);
      const customer = await createUser(prisma, { name: 'Olena Booker' });
      const mine = await createRegistration(prisma, session, { customerId: customer.id });
      await createRegistration(prisma, await createSession(prisma, await createEvent(prisma)));

      const response = await organizer.agent
        .get('/api/registrations')
        .query({ sessionId: session.id })
        .expect(200);

      expect(response.body).toEqual([
        expect.objectContaining({
          id: mine.id,
          status: 'CONFIRMED',
          customer: { id: customer.id, name: 'Olena Booker', email: customer.email },
          session: expect.objectContaining({ id: session.id }),
          event: { id: event.id, title: event.title, status: event.status },
        }),
      ]);
    });

    it("never lists another organizer's registrations, even when filtered by their event", async () => {
      const foreign = await createEvent(prisma);
      await createRegistration(prisma, await createSession(prisma, foreign));

      const response = await organizer.agent
        .get('/api/registrations')
        .query({ eventId: foreign.id })
        .expect(200);

      expect(response.body).toEqual([]);
      expect(response.headers['x-total-count']).toBe('0');
    });

    it('lets an admin see every registration of any event', async () => {
      const event = await createEvent(prisma);
      await createRegistration(prisma, await createSession(prisma, event));

      const response = await admin.agent
        .get('/api/registrations')
        .query({ eventId: event.id })
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('filters by status and searches by customer email', async () => {
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: organizer.userId }),
      );
      const waiting = await createRegistration(prisma, session, { status: 'WAITLISTED' });
      await createRegistration(prisma, session);
      const customer = await prisma.user.findUniqueOrThrow({ where: { id: waiting.customerId } });

      const byStatus = await organizer.agent
        .get('/api/registrations')
        .query({ sessionId: session.id, status: 'WAITLISTED' })
        .expect(200);
      const bySearch = await organizer.agent
        .get('/api/registrations')
        .query({ q: customer.email })
        .expect(200);

      expect(byStatus.body.map((row: { id: string }) => row.id)).toEqual([waiting.id]);
      expect(bySearch.body.map((row: { id: string }) => row.id)).toEqual([waiting.id]);
    });

    it('rejects an unknown status filter', async () => {
      await organizer.agent.get('/api/registrations').query({ status: 'LOST' }).expect(400);
    });

    it('is closed to customers', async () => {
      const customer = await signedInAgent(app);

      await customer.agent.get('/api/registrations').expect(403);
    });
  });

  describe('GET /api/registrations/:id', () => {
    it("answers 404 for another organizer's registration", async () => {
      const foreign = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma)),
      );

      await organizer.agent.get(`/api/registrations/${foreign.id}`).expect(404);
    });

    it('shows a registration of an own event', async () => {
      const own = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma, { organizerId: organizer.userId })),
      );

      const response = await organizer.agent.get(`/api/registrations/${own.id}`).expect(200);

      expect(response.body.id).toBe(own.id);
    });
  });

  describe('POST /api/registrations/bulk-status', () => {
    it('cancels bookings and promotes the waitlist for each freed seat', async () => {
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: organizer.userId }),
        {
          capacity: 1,
          confirmedCount: 1,
        },
      );
      const confirmed = await createRegistration(prisma, session);
      const waiting = await createRegistration(prisma, session, { status: 'WAITLISTED' });

      const response = await bulk(organizer, { ids: [confirmed.id], status: 'CANCELLED' });

      expect(response.body).toEqual({
        results: [{ id: confirmed.id, ok: true, status: 'CANCELLED' }],
      });
      expect(await statusOf(waiting.id)).toBe('CONFIRMED');
    });

    it('reports each row on its own: success, wrong transition and not found', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - HOUR_MS),
      });
      const session = await createSession(prisma, event, { confirmedCount: 1 });
      const came = await createRegistration(prisma, session);
      const waiting = await createRegistration(prisma, session, { status: 'WAITLISTED' });
      const foreign = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma)),
      );

      const response = await bulk(organizer, {
        ids: [came.id, waiting.id, foreign.id, UNKNOWN_ID],
        status: 'ATTENDED',
      });

      expect(response.body.results).toEqual([
        { id: came.id, ok: true, status: 'ATTENDED' },
        {
          id: waiting.id,
          ok: false,
          code: 'INVALID_TRANSITION',
          message: 'A registration cannot go from WAITLISTED to ATTENDED',
        },
        { id: foreign.id, ok: false, code: 'NOT_FOUND', message: 'Registration not found' },
        { id: UNKNOWN_ID, ok: false, code: 'NOT_FOUND', message: 'Registration not found' },
      ]);
      expect(await statusOf(foreign.id)).toBe('CONFIRMED');
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).confirmedCount,
      ).toBe(1);
    });

    it('refuses to record attendance before the session starts', async () => {
      const own = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma, { organizerId: organizer.userId }), {
          confirmedCount: 1,
        }),
      );

      const response = await bulk(organizer, { ids: [own.id], status: 'ATTENDED' });

      expect(response.body.results[0]).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
      expect(await statusOf(own.id)).toBe('CONFIRMED');
    });

    it('refuses to cancel once the session has started', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - HOUR_MS),
      });
      const own = await createRegistration(
        prisma,
        await createSession(prisma, event, { confirmedCount: 1 }),
      );

      const response = await bulk(organizer, { ids: [own.id], status: 'CANCELLED' });

      expect(response.body.results[0]).toMatchObject({ ok: false, code: 'SESSION_STARTED' });
    });

    it('lets staff clear waitlist places after the session started', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - HOUR_MS),
      });
      const session = await createSession(prisma, event, { capacity: 1, confirmedCount: 1 });
      await createRegistration(prisma, session);
      const leftover = await createRegistration(prisma, session, { status: 'WAITLISTED' });

      const response = await bulk(organizer, { ids: [leftover.id], status: 'CANCELLED' });

      expect(response.body.results[0]).toMatchObject({ ok: true, status: 'CANCELLED' });
    });

    it('refuses attendance for a draft event', async () => {
      const event = await createEvent(prisma, {
        organizerId: organizer.userId,
        startsAt: new Date(Date.now() - HOUR_MS),
        status: 'DRAFT',
      });
      const own = await createRegistration(
        prisma,
        await createSession(prisma, event, { confirmedCount: 1 }),
      );

      const response = await bulk(organizer, { ids: [own.id], status: 'ATTENDED' });

      expect(response.body.results[0]).toMatchObject({
        ok: false,
        code: 'INVALID_TRANSITION',
        message: 'Attendance can only be recorded for published or completed events',
      });
    });

    it('processes a repeated id once', async () => {
      const own = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma, { organizerId: organizer.userId }), {
          confirmedCount: 1,
        }),
      );

      const response = await bulk(organizer, { ids: [own.id, own.id], status: 'CANCELLED' });

      expect(response.body.results).toHaveLength(1);
    });

    it('lets an admin change registrations of any event', async () => {
      const any = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma), { confirmedCount: 1 }),
      );

      const response = await bulk(admin, { ids: [any.id], status: 'CANCELLED' });

      expect(response.body.results[0]).toMatchObject({ ok: true });
    });

    it.each([
      ['no ids', { ids: [], status: 'CANCELLED' }, 'ids'],
      [
        'too many ids',
        {
          ids: Array.from({ length: BULK_STATUS_MAX_IDS + 1 }, () => UNKNOWN_ID),
          status: 'CANCELLED',
        },
        'ids',
      ],
      ['a malformed id', { ids: ['nope'], status: 'CANCELLED' }, 'ids'],
      ['a status staff cannot set', { ids: [UNKNOWN_ID], status: 'CONFIRMED' }, 'status'],
    ])('rejects %s', async (_label, body, field) => {
      const response = await bulk(organizer, body, 400);

      expect(response.body.details[0].field).toBe(field);
    });

    it('is closed to customers', async () => {
      const customer = await signedInAgent(app);

      await bulk(customer, { ids: [UNKNOWN_ID], status: 'CANCELLED' }, 403);
    });
  });
});
