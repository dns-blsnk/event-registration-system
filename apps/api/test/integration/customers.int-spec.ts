import { randomUUID } from 'node:crypto';

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

describe('customers API', () => {
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

  function marker(): string {
    return randomUUID().slice(0, 8);
  }

  it('shows an organizer only customers who registered for their events, counting only those registrations', async () => {
    const tag = marker();
    const own = await createSession(
      prisma,
      await createEvent(prisma, { organizerId: organizer.userId }),
    );
    const foreign = await createSession(prisma, await createEvent(prisma));
    const booker = await createUser(prisma, { name: `Booker ${tag}` });
    const stranger = await createUser(prisma, { name: `Stranger ${tag}` });
    await createRegistration(prisma, own, { customerId: booker.id, status: 'CANCELLED' });
    await createRegistration(prisma, foreign, { customerId: booker.id });
    await createRegistration(prisma, foreign, { customerId: stranger.id });

    const response = await organizer.agent.get('/api/customers').query({ q: tag }).expect(200);

    expect(response.body).toEqual([
      {
        id: booker.id,
        name: booker.name,
        email: booker.email,
        createdAt: booker.createdAt.toISOString(),
        registrationCount: 1,
      },
    ]);
    expect(response.headers['x-total-count']).toBe('1');
  });

  it('shows an admin every customer with all their registrations, but never staff accounts', async () => {
    const tag = marker();
    const customer = await createUser(prisma, { name: `Customer ${tag}` });
    await createUser(prisma, { name: `Organizer ${tag}`, role: 'ORGANIZER' });
    await createRegistration(prisma, await createSession(prisma, await createEvent(prisma)), {
      customerId: customer.id,
    });

    const response = await admin.agent.get('/api/customers').query({ q: tag }).expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: customer.id, registrationCount: 1 }),
    ]);
  });

  it('searches by email and sorts by name', async () => {
    const tag = marker();
    const b = await createUser(prisma, { name: `B ${tag}`, email: `b-${tag}@test.local` });
    const a = await createUser(prisma, { name: `A ${tag}`, email: `a-${tag}@test.local` });

    const response = await admin.agent
      .get('/api/customers')
      .query({ q: `-${tag}@`, _sort: 'name', _order: 'asc' })
      .expect(200);

    expect(response.body.map((customer: { id: string }) => customer.id)).toEqual([a.id, b.id]);
  });

  it('answers 404 when an organizer opens a customer who never booked their events', async () => {
    const stranger = await createUser(prisma);

    await organizer.agent.get(`/api/customers/${stranger.id}`).expect(404);
    await admin.agent.get(`/api/customers/${stranger.id}`).expect(200);
  });

  it('answers 404 for a staff account that never booked anything', async () => {
    await admin.agent.get(`/api/customers/${organizer.userId}`).expect(404);
  });

  it('opens a customer of an own event for an organizer', async () => {
    const booker = await createUser(prisma);
    const own = await createSession(
      prisma,
      await createEvent(prisma, { organizerId: organizer.userId }),
    );
    await createRegistration(prisma, own, { customerId: booker.id });

    const response = await organizer.agent.get(`/api/customers/${booker.id}`).expect(200);

    expect(response.body).toMatchObject({ id: booker.id, registrationCount: 1 });
  });

  it('keeps a customer promoted to staff, because their bookings stay', async () => {
    const promoted = await createUser(prisma, { role: 'ORGANIZER' });
    const own = await createSession(
      prisma,
      await createEvent(prisma, { organizerId: organizer.userId }),
    );
    await createRegistration(prisma, own, { customerId: promoted.id });

    await organizer.agent.get(`/api/customers/${promoted.id}`).expect(200);
    await admin.agent.get(`/api/customers/${promoted.id}`).expect(200);
  });

  it.each([
    ['email', 'desc'],
    ['createdAt', 'asc'],
  ] as const)('sorts by %s %s', async (field, order) => {
    const tag = marker();
    // Explicit timestamps: two rows created back to back can share a millisecond.
    const first = await createUser(prisma, {
      name: `S ${tag}`,
      email: `a-${tag}@test.local`,
      createdAt: new Date(Date.now() - 60_000),
    });
    const second = await createUser(prisma, {
      name: `S ${tag}`,
      email: `b-${tag}@test.local`,
      createdAt: new Date(),
    });

    const response = await admin.agent
      .get('/api/customers')
      .query({ q: `S ${tag}`, _sort: field, _order: order })
      .expect(200);

    const expected = field === 'email' ? [second.id, first.id] : [first.id, second.id];
    expect(response.body.map((customer: { id: string }) => customer.id)).toEqual(expected);
  });

  it('sorts by registration count', async () => {
    const tag = marker();
    const busy = await createUser(prisma, { name: `R ${tag} busy` });
    const idle = await createUser(prisma, { name: `R ${tag} idle` });
    await createRegistration(prisma, await createSession(prisma, await createEvent(prisma)), {
      customerId: busy.id,
    });

    const response = await admin.agent
      .get('/api/customers')
      .query({ q: `R ${tag}`, _sort: 'registrationCount', _order: 'desc' })
      .expect(200);

    expect(response.body.map((customer: { id: string }) => customer.id)).toEqual([
      busy.id,
      idle.id,
    ]);
  });

  it('pages through results with a total count', async () => {
    const tag = marker();
    for (const letter of ['a', 'b', 'c']) {
      await createUser(prisma, { name: `P ${tag} ${letter}` });
    }

    const response = await admin.agent
      .get('/api/customers')
      .query({ q: `P ${tag}`, _sort: 'name', _order: 'asc', _start: 1, _end: 2 })
      .expect(200);

    expect(response.headers['x-total-count']).toBe('3');
    expect(response.body.map((customer: { name: string }) => customer.name)).toEqual([
      `P ${tag} b`,
    ]);
  });

  it('rejects sorting by an unknown field', async () => {
    await admin.agent.get('/api/customers').query({ _sort: 'passwordHash' }).expect(400);
  });

  it('is closed to customers', async () => {
    const customer = await signedInAgent(app);

    await customer.agent.get('/api/customers').expect(403);
    await customer.agent.get(`/api/customers/${customer.userId}`).expect(403);
  });
});
