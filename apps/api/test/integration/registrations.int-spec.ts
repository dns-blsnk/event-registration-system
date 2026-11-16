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

import type { Session } from '../../src/generated/prisma/client.js';
import type { INestApplication } from '@nestjs/common';

const HOUR_MS = 3_600_000;

describe('customer registrations API', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function book(customer: SignedInAgent, sessionId: string, expected: number) {
    return customer.agent
      .post('/api/my-registrations')
      .set('x-csrf-token', customer.csrfToken)
      .send({ sessionId })
      .expect(expected);
  }

  async function cancel(customer: SignedInAgent, id: string, expected: number) {
    return customer.agent
      .post(`/api/my-registrations/${id}/cancel`)
      .set('x-csrf-token', customer.csrfToken)
      .expect(expected);
  }

  async function seatsOf(session: Session): Promise<number> {
    return (await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).confirmedCount;
  }

  describe('booking', () => {
    it('confirms a seat while seats are free', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      const session = await createSession(prisma, event, { capacity: 2 });

      const response = await book(customer, session.id, 201);

      expect(response.body).toMatchObject({
        status: 'CONFIRMED',
        waitlistPosition: null,
        session: { id: session.id },
        event: { id: event.id, title: event.title },
      });
      expect(await seatsOf(session)).toBe(1);
    });

    it('puts the customer on the waitlist when the session is full', async () => {
      const session = await createSession(prisma, await createEvent(prisma), {
        capacity: 1,
        confirmedCount: 1,
      });
      await createRegistration(prisma, session);
      const first = await signedInAgent(app);
      const second = await signedInAgent(app);

      const one = await book(first, session.id, 201);
      const two = await book(second, session.id, 201);

      expect(one.body).toMatchObject({ status: 'WAITLISTED', waitlistPosition: 1 });
      expect(two.body).toMatchObject({ status: 'WAITLISTED', waitlistPosition: 2 });
      expect(await seatsOf(session)).toBe(1);
    });

    it.each(['CONFIRMED', 'WAITLISTED', 'ATTENDED'] as const)(
      'refuses a second booking while one is %s',
      async (status) => {
        const customer = await signedInAgent(app);
        const session = await createSession(prisma, await createEvent(prisma));
        await createRegistration(prisma, session, { customerId: customer.userId, status });

        const response = await book(customer, session.id, 409);

        expect(response.body.code).toBe('ALREADY_REGISTERED');
      },
    );

    it('books again after a cancellation by reusing the registration', async () => {
      const customer = await signedInAgent(app);
      const session = await createSession(prisma, await createEvent(prisma));
      const old = await createRegistration(prisma, session, {
        customerId: customer.userId,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });

      const response = await book(customer, session.id, 201);

      expect(response.body).toMatchObject({ id: old.id, status: 'CONFIRMED', cancelledAt: null });
      expect(await prisma.registration.count({ where: { sessionId: session.id } })).toBe(1);
    });

    it.each(['DRAFT', 'CANCELLED', 'COMPLETED'] as const)(
      'refuses booking for a %s event',
      async (status) => {
        const customer = await signedInAgent(app);
        const session = await createSession(prisma, await createEvent(prisma, { status }));

        const response = await book(customer, session.id, 409);

        expect(response.body.code).toBe('EVENT_NOT_OPEN');
      },
    );

    it('refuses booking a session that has started', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma, { startsAt: new Date(Date.now() - HOUR_MS) });
      const session = await createSession(prisma, event);

      const response = await book(customer, session.id, 409);

      expect(response.body.code).toBe('SESSION_STARTED');
    });

    it('refuses a booking that overlaps a confirmed session', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      const taken = await createSession(prisma, event);
      const overlapping = await createSession(prisma, event, {
        startsAt: new Date(event.startsAt.getTime() + HOUR_MS / 2),
      });
      await createRegistration(prisma, taken, { customerId: customer.userId });

      const response = await book(customer, overlapping.id, 409);

      expect(response.body.code).toBe('SCHEDULE_CONFLICT');
    });

    it('lets a customer join the waitlist of a full session that overlaps a confirmed one', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      const taken = await createSession(prisma, event);
      const full = await createSession(prisma, event, {
        startsAt: new Date(event.startsAt.getTime() + HOUR_MS / 2),
        capacity: 1,
        confirmedCount: 1,
      });
      await createRegistration(prisma, full);
      await createRegistration(prisma, taken, { customerId: customer.userId });

      const response = await book(customer, full.id, 201);

      expect(response.body.status).toBe('WAITLISTED');
    });

    it('serves the waitlist before a new booker takes a free seat', async () => {
      const customer = await signedInAgent(app);
      const session = await createSession(prisma, await createEvent(prisma), { capacity: 1 });
      const waiting = await createRegistration(prisma, session, { status: 'WAITLISTED' });

      const response = await book(customer, session.id, 201);

      expect(response.body.status).toBe('WAITLISTED');
      expect(
        (await prisma.registration.findUniqueOrThrow({ where: { id: waiting.id } })).status,
      ).toBe('CONFIRMED');
    });

    it('gives a free seat to a new booker when everyone waiting has a conflict', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      const session = await createSession(prisma, event, { capacity: 1 });
      const parallel = await createSession(prisma, event, { confirmedCount: 1 });
      const busy = await createUser(prisma);
      await createRegistration(prisma, parallel, { customerId: busy.id });
      await createRegistration(prisma, session, { customerId: busy.id, status: 'WAITLISTED' });

      const response = await book(customer, session.id, 201);

      expect(response.body.status).toBe('CONFIRMED');
    });

    it('answers 404 for an unknown session', async () => {
      const customer = await signedInAgent(app);

      await book(customer, '00000000-0000-4000-8000-000000000000', 404);
    });

    it('rejects a malformed session id', async () => {
      const customer = await signedInAgent(app);

      const response = await book(customer, 'not-a-uuid', 400);

      expect(response.body.details[0].field).toBe('sessionId');
    });

    it.each(['ADMIN', 'ORGANIZER'] as const)('is closed to %s', async (role) => {
      const staff = await signedInAgent(app, role);
      const session = await createSession(prisma, await createEvent(prisma));

      await book(staff, session.id, 403);
    });

    it('never sells more seats than the capacity under concurrent bookings', async () => {
      const capacity = 3;
      const bookers = 10;
      const session = await createSession(prisma, await createEvent(prisma), { capacity });
      const customers = await Promise.all(
        Array.from({ length: bookers }, async () => signedInAgent(app)),
      );

      const responses = await Promise.all(
        customers.map(async (customer) => book(customer, session.id, 201)),
      );

      const statuses = responses.map((response) => response.body.status as string);
      expect(statuses.filter((status) => status === 'CONFIRMED')).toHaveLength(capacity);
      expect(statuses.filter((status) => status === 'WAITLISTED')).toHaveLength(bookers - capacity);
      expect(await seatsOf(session)).toBe(capacity);
    });

    it('lets one customer hold only one of two overlapping seats when booking both at once', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      const first = await createSession(prisma, event);
      const second = await createSession(prisma, event, {
        startsAt: new Date(event.startsAt.getTime() + HOUR_MS / 2),
      });

      const responses = await Promise.all([
        customer.agent
          .post('/api/my-registrations')
          .set('x-csrf-token', customer.csrfToken)
          .send({ sessionId: first.id }),
        customer.agent
          .post('/api/my-registrations')
          .set('x-csrf-token', customer.csrfToken)
          .send({ sessionId: second.id }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    });
  });

  describe('cancelling', () => {
    it('frees the seat and promotes the oldest waitlisted customer', async () => {
      const customer = await signedInAgent(app);
      const session = await createSession(prisma, await createEvent(prisma), {
        capacity: 1,
        confirmedCount: 1,
      });
      const mine = await createRegistration(prisma, session, { customerId: customer.userId });
      const oldest = await createRegistration(prisma, session, {
        status: 'WAITLISTED',
        createdAt: new Date(Date.now() - 2 * HOUR_MS),
      });
      const newer = await createRegistration(prisma, session, {
        status: 'WAITLISTED',
        createdAt: new Date(Date.now() - HOUR_MS),
      });

      const response = await cancel(customer, mine.id, 200);

      expect(response.body).toMatchObject({ status: 'CANCELLED' });
      expect(response.body.cancelledAt).not.toBeNull();
      const statuses = await prisma.registration.findMany({
        where: { id: { in: [oldest.id, newer.id] } },
        orderBy: { createdAt: 'asc' },
      });
      expect(statuses.map((registration) => registration.status)).toEqual([
        'CONFIRMED',
        'WAITLISTED',
      ]);
      expect(await seatsOf(session)).toBe(1);
    });

    it('skips a waitlisted customer whose confirmed sessions would overlap', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      const session = await createSession(prisma, event, { capacity: 1, confirmedCount: 1 });
      const parallel = await createSession(prisma, event, { confirmedCount: 1 });
      const mine = await createRegistration(prisma, session, { customerId: customer.userId });
      const busy = await createUser(prisma);
      await createRegistration(prisma, parallel, { customerId: busy.id });
      const busyWaiting = await createRegistration(prisma, session, {
        customerId: busy.id,
        status: 'WAITLISTED',
        createdAt: new Date(Date.now() - 2 * HOUR_MS),
      });
      const free = await createRegistration(prisma, session, {
        status: 'WAITLISTED',
        createdAt: new Date(Date.now() - HOUR_MS),
      });

      await cancel(customer, mine.id, 200);

      expect(
        (await prisma.registration.findUniqueOrThrow({ where: { id: busyWaiting.id } })).status,
      ).toBe('WAITLISTED');
      expect((await prisma.registration.findUniqueOrThrow({ where: { id: free.id } })).status).toBe(
        'CONFIRMED',
      );
    });

    it('handles two cancellations that promote each other at the same time', async () => {
      const event = await createEvent(prisma);
      const morning = await createSession(prisma, event, { capacity: 1, confirmedCount: 1 });
      const afternoon = await createSession(prisma, event, {
        startsAt: new Date(event.startsAt.getTime() + 4 * HOUR_MS),
        capacity: 1,
        confirmedCount: 1,
      });
      const x = await signedInAgent(app);
      const y = await signedInAgent(app);
      const xMorning = await createRegistration(prisma, morning, { customerId: x.userId });
      const yAfternoon = await createRegistration(prisma, afternoon, { customerId: y.userId });
      const yMorning = await createRegistration(prisma, morning, {
        customerId: y.userId,
        status: 'WAITLISTED',
      });
      const xAfternoon = await createRegistration(prisma, afternoon, {
        customerId: x.userId,
        status: 'WAITLISTED',
      });

      await Promise.all([cancel(x, xMorning.id, 200), cancel(y, yAfternoon.id, 200)]);

      const promoted = await prisma.registration.findMany({
        where: { id: { in: [yMorning.id, xAfternoon.id] } },
      });
      expect(promoted.map((registration) => registration.status)).toEqual([
        'CONFIRMED',
        'CONFIRMED',
      ]);
    });

    it('leaves a seat free when nobody is waiting', async () => {
      const customer = await signedInAgent(app);
      const session = await createSession(prisma, await createEvent(prisma), {
        capacity: 2,
        confirmedCount: 1,
      });
      const mine = await createRegistration(prisma, session, { customerId: customer.userId });

      await cancel(customer, mine.id, 200);

      expect(await seatsOf(session)).toBe(0);
    });

    it('leaving the waitlist does not change the seats', async () => {
      const customer = await signedInAgent(app);
      const session = await createSession(prisma, await createEvent(prisma), {
        capacity: 1,
        confirmedCount: 1,
      });
      await createRegistration(prisma, session);
      const mine = await createRegistration(prisma, session, {
        customerId: customer.userId,
        status: 'WAITLISTED',
      });

      await cancel(customer, mine.id, 200);

      expect(await seatsOf(session)).toBe(1);
    });

    it('refuses to cancel twice', async () => {
      const customer = await signedInAgent(app);
      const session = await createSession(prisma, await createEvent(prisma));
      const mine = await createRegistration(prisma, session, {
        customerId: customer.userId,
        status: 'CANCELLED',
      });

      const response = await cancel(customer, mine.id, 409);

      expect(response.body.code).toBe('INVALID_TRANSITION');
    });

    it('refuses to cancel once the session has started', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma, { startsAt: new Date(Date.now() - HOUR_MS) });
      const session = await createSession(prisma, event, { confirmedCount: 1 });
      const mine = await createRegistration(prisma, session, { customerId: customer.userId });

      const response = await cancel(customer, mine.id, 409);

      expect(response.body.code).toBe('SESSION_STARTED');
    });

    it("answers 404 for another customer's registration", async () => {
      const customer = await signedInAgent(app);
      const session = await createSession(prisma, await createEvent(prisma), { confirmedCount: 1 });
      const foreign = await createRegistration(prisma, session);

      await cancel(customer, foreign.id, 404);

      expect(
        (await prisma.registration.findUniqueOrThrow({ where: { id: foreign.id } })).status,
      ).toBe('CONFIRMED');
    });
  });

  describe('listing', () => {
    it("shows only the customer's own registrations, newest first", async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      const older = await createRegistration(prisma, await createSession(prisma, event), {
        customerId: customer.userId,
        createdAt: new Date(Date.now() - HOUR_MS),
      });
      const newer = await createRegistration(prisma, await createSession(prisma, event), {
        customerId: customer.userId,
      });
      await createRegistration(prisma, await createSession(prisma, event));

      const response = await customer.agent.get('/api/my-registrations').expect(200);

      expect(response.headers['x-total-count']).toBe('2');
      expect(response.body.map((registration: { id: string }) => registration.id)).toEqual([
        newer.id,
        older.id,
      ]);
    });

    it('filters by status', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma);
      await createRegistration(prisma, await createSession(prisma, event), {
        customerId: customer.userId,
      });
      const cancelled = await createRegistration(prisma, await createSession(prisma, event), {
        customerId: customer.userId,
        status: 'CANCELLED',
      });

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({ status: 'CANCELLED' })
        .expect(200);

      expect(response.body.map((registration: { id: string }) => registration.id)).toEqual([
        cancelled.id,
      ]);
    });

    it('finds registrations by session or event title, case-insensitively', async () => {
      const customer = await signedInAgent(app);
      const reactEvent = await createEvent(prisma, { title: 'React Summit' });
      const otherEvent = await createEvent(prisma, { title: 'Data Day' });
      const byEvent = await createRegistration(prisma, await createSession(prisma, reactEvent), {
        customerId: customer.userId,
      });
      const bySession = await createRegistration(
        prisma,
        await createSession(prisma, otherEvent, { title: 'Hooks with react' }),
        { customerId: customer.userId },
      );
      await createRegistration(prisma, await createSession(prisma, otherEvent), {
        customerId: customer.userId,
      });

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({ q: 'REACT' })
        .expect(200);

      expect(response.body.map((registration: { id: string }) => registration.id).sort()).toEqual(
        [byEvent.id, bySession.id].sort(),
      );
    });

    it("never finds another customer's registration by title", async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma, { title: 'Private Workshop' });
      await createRegistration(prisma, await createSession(prisma, event));

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({ q: 'Private Workshop' })
        .expect(200);

      expect(response.body).toEqual([]);
      expect(response.headers['x-total-count']).toBe('0');
    });

    it('filters by the day the session starts', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma, { startsAt: '2031-03-01T09:00:00.000Z' });
      const inRange = await createRegistration(
        prisma,
        await createSession(prisma, event, { startsAt: '2031-03-10T09:00:00.000Z' }),
        { customerId: customer.userId },
      );
      await createRegistration(
        prisma,
        await createSession(prisma, event, { startsAt: '2031-03-20T09:00:00.000Z' }),
        { customerId: customer.userId },
      );

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({ startsFrom: '2031-03-09', startsTo: '2031-03-10' })
        .expect(200);

      expect(response.body.map((registration: { id: string }) => registration.id)).toEqual([
        inRange.id,
      ]);
    });

    it('combines the title search with the status and the start days', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma, {
        title: 'React Summit',
        startsAt: '2031-04-01T09:00:00.000Z',
      });
      const sessionOn = (startsAt: string) => createSession(prisma, event, { startsAt });
      const match = await createRegistration(prisma, await sessionOn('2031-04-05T09:00:00.000Z'), {
        customerId: customer.userId,
      });
      await createRegistration(prisma, await sessionOn('2031-04-05T13:00:00.000Z'), {
        customerId: customer.userId,
        status: 'CANCELLED',
      });
      await createRegistration(prisma, await sessionOn('2031-04-25T09:00:00.000Z'), {
        customerId: customer.userId,
      });

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({
          q: 'react',
          status: 'CONFIRMED',
          startsFrom: '2031-04-01',
          startsTo: '2031-04-10',
        })
        .expect(200);

      expect(response.body.map((registration: { id: string }) => registration.id)).toEqual([
        match.id,
      ]);
    });

    it('takes a range open at one end', async () => {
      const customer = await signedInAgent(app);
      const event = await createEvent(prisma, { startsAt: '2031-05-01T09:00:00.000Z' });
      await createRegistration(
        prisma,
        await createSession(prisma, event, { startsAt: '2031-05-02T09:00:00.000Z' }),
        { customerId: customer.userId },
      );
      const later = await createRegistration(
        prisma,
        await createSession(prisma, event, { startsAt: '2031-05-20T09:00:00.000Z' }),
        { customerId: customer.userId },
      );

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({ startsFrom: '2031-05-10' })
        .expect(200);

      expect(response.body.map((registration: { id: string }) => registration.id)).toEqual([
        later.id,
      ]);
    });

    it('rejects a start day that is not a date', async () => {
      const customer = await signedInAgent(app);

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({ startsFrom: 'not-a-date' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('rejects a date range that ends before it starts', async () => {
      const customer = await signedInAgent(app);

      const response = await customer.agent
        .get('/api/my-registrations')
        .query({ startsFrom: '2031-03-10', startsTo: '2031-03-01' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it("answers 404 when showing another customer's registration", async () => {
      const customer = await signedInAgent(app);
      const foreign = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma)),
      );

      await customer.agent.get(`/api/my-registrations/${foreign.id}`).expect(404);
    });
  });

  describe('session changes', () => {
    it('refuses to move a session with active registrations', async () => {
      const organizer = await signedInAgent(app, 'ORGANIZER');
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event, { confirmedCount: 1 });
      await createRegistration(prisma, session);

      const response = await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({
          startsAt: new Date(event.startsAt.getTime() + HOUR_MS).toISOString(),
          endsAt: new Date(event.startsAt.getTime() + 2 * HOUR_MS).toISOString(),
        })
        .expect(409);

      expect(response.body.message).toBe('Sessions with active registrations cannot be moved');
    });

    it('allows moving a session whose registrations were all cancelled', async () => {
      const organizer = await signedInAgent(app, 'ORGANIZER');
      const event = await createEvent(prisma, { organizerId: organizer.userId });
      const session = await createSession(prisma, event);
      await createRegistration(prisma, session, { status: 'CANCELLED' });

      await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({
          startsAt: new Date(event.startsAt.getTime() + HOUR_MS).toISOString(),
          endsAt: new Date(event.startsAt.getTime() + 2 * HOUR_MS).toISOString(),
        })
        .expect(200);
    });
  });

  describe('capacity increase', () => {
    it('promotes waitlisted customers into the new seats', async () => {
      const organizer = await signedInAgent(app, 'ORGANIZER');
      const session = await createSession(
        prisma,
        await createEvent(prisma, { organizerId: organizer.userId }),
        {
          capacity: 1,
          confirmedCount: 1,
        },
      );
      await createRegistration(prisma, session);
      const waiting = await createRegistration(prisma, session, { status: 'WAITLISTED' });

      const response = await organizer.agent
        .patch(`/api/sessions/${session.id}`)
        .set('x-csrf-token', organizer.csrfToken)
        .send({ capacity: 3 })
        .expect(200);

      expect(response.body).toMatchObject({
        capacity: 3,
        confirmedCount: 2,
        seatsLeft: 1,
        waitlistCount: 0,
      });
      expect(
        (await prisma.registration.findUniqueOrThrow({ where: { id: waiting.id } })).status,
      ).toBe('CONFIRMED');
    });
  });
});
