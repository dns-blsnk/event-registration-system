import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent, TEST_PASSWORD } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import {
  createEvent,
  createRegistration,
  createSession,
  createUser,
} from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

describe('users API (admin only)', () => {
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

  describe('GET /api/users', () => {
    it('lists users with the total in x-total-count and never exposes password hashes', async () => {
      const marker = randomUUID().slice(0, 8);
      await createUser(prisma, { name: `List ${marker} one` });
      await createUser(prisma, { name: `List ${marker} two` });

      const response = await admin.agent
        .get('/api/users')
        .query({ q: marker, _sort: 'name', _order: 'asc' })
        .expect(200);

      expect(response.headers['x-total-count']).toBe('2');
      expect(response.body.map((user: { name: string }) => user.name)).toEqual([
        `List ${marker} one`,
        `List ${marker} two`,
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|argon2/);
    });

    it('filters by role', async () => {
      const marker = randomUUID().slice(0, 8);
      await createUser(prisma, { name: `Role ${marker}`, role: 'ORGANIZER' });
      await createUser(prisma, { name: `Role ${marker}`, role: 'CUSTOMER' });

      const response = await admin.agent
        .get('/api/users')
        .query({ q: marker, role: 'ORGANIZER' })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].role).toBe('ORGANIZER');
    });

    it('paginates with _start and _end', async () => {
      const marker = randomUUID().slice(0, 8);
      for (const suffix of ['a', 'b', 'c']) {
        await createUser(prisma, { name: `Page ${marker} ${suffix}` });
      }

      const response = await admin.agent
        .get('/api/users')
        .query({ q: marker, _sort: 'name', _order: 'asc', _start: 1, _end: 2 })
        .expect(200);

      expect(response.headers['x-total-count']).toBe('3');
      expect(response.body.map((user: { name: string }) => user.name)).toEqual([
        `Page ${marker} b`,
      ]);
    });

    it('treats LIKE wildcards in the search as literal characters', async () => {
      const marker = randomUUID().slice(0, 8);
      await createUser(prisma, { name: `Wild ${marker} plain` });
      await createUser(prisma, { name: `Wild ${marker} under_score` });

      const response = await admin.agent
        .get('/api/users')
        .query({ q: `${marker} under_` })
        .expect(200);

      expect(response.body.map((user: { name: string }) => user.name)).toEqual([
        `Wild ${marker} under_score`,
      ]);
    });

    it.each([
      [{ _sort: 'passwordHash' }, '_sort'],
      [{ role: 'SUPERUSER' }, 'role'],
    ])('rejects invalid list parameters %j', async (query, field) => {
      const response = await admin.agent.get('/api/users').query(query).expect(400);

      expect(response.body.details[0].field).toBe(field);
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns one user', async () => {
      const user = await createUser(prisma);

      const response = await admin.agent.get(`/api/users/${user.id}`).expect(200);

      expect(response.body).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'CUSTOMER',
        createdAt: user.createdAt.toISOString(),
      });
    });

    it('answers 404 for an unknown id and 400 for a malformed one', async () => {
      await admin.agent.get(`/api/users/${randomUUID()}`).expect(404);
      await admin.agent.get('/api/users/not-a-uuid').expect(400);
    });
  });

  describe('POST /api/users', () => {
    it('creates an organizer with a normalised email', async () => {
      const email = `New-${randomUUID()}@Test.Local`;

      const response = await admin.agent
        .post('/api/users')
        .set('x-csrf-token', admin.csrfToken)
        .send({ email, name: '  Olga  ', role: 'ORGANIZER', password: TEST_PASSWORD })
        .expect(201);

      expect(response.body).toMatchObject({
        email: email.toLowerCase(),
        name: 'Olga',
        role: 'ORGANIZER',
      });
    });

    it('rejects a duplicate email with 409', async () => {
      const existing = await createUser(prisma);

      const response = await admin.agent
        .post('/api/users')
        .set('x-csrf-token', admin.csrfToken)
        .send({ email: existing.email, name: 'Dup', role: 'CUSTOMER', password: TEST_PASSWORD })
        .expect(409);

      expect(response.body.code).toBe('CONFLICT');
    });

    it('rejects an unknown role', async () => {
      await admin.agent
        .post('/api/users')
        .set('x-csrf-token', admin.csrfToken)
        .send({
          email: `${randomUUID()}@test.local`,
          name: 'X',
          role: 'ROOT',
          password: TEST_PASSWORD,
        })
        .expect(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('renames a user', async () => {
      const user = await createUser(prisma);

      const response = await admin.agent
        .patch(`/api/users/${user.id}`)
        .set('x-csrf-token', admin.csrfToken)
        .send({ name: 'Renamed' })
        .expect(200);

      expect(response.body.name).toBe('Renamed');
    });

    it('changes a role and signs the user out everywhere', async () => {
      const target = await signedInAgent(app, 'CUSTOMER');

      await admin.agent
        .patch(`/api/users/${target.userId}`)
        .set('x-csrf-token', admin.csrfToken)
        .send({ role: 'ORGANIZER' })
        .expect(200);

      await target.agent.get('/api/auth/me').expect(401);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: target.userId } })).role).toBe(
        'ORGANIZER',
      );
    });

    it('does not let an admin change their own role', async () => {
      const response = await admin.agent
        .patch(`/api/users/${admin.userId}`)
        .set('x-csrf-token', admin.csrfToken)
        .send({ role: 'CUSTOMER' })
        .expect(409);

      expect(response.body.message).toBe('You cannot change your own role');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('deletes a user and their sessions', async () => {
      const target = await signedInAgent(app, 'CUSTOMER');

      await admin.agent
        .delete(`/api/users/${target.userId}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(204);

      await admin.agent.get(`/api/users/${target.userId}`).expect(404);
      await target.agent.get('/api/auth/me').expect(401);
    });

    it('refuses to delete an organizer who owns events', async () => {
      const event = await createEvent(prisma);

      const response = await admin.agent
        .delete(`/api/users/${event.organizerId}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(409);

      expect(response.body.message).toBe(
        'This user owns events or has registrations and cannot be deleted',
      );
    });

    it('refuses to delete a customer who has registrations', async () => {
      const registration = await createRegistration(
        prisma,
        await createSession(prisma, await createEvent(prisma)),
      );

      await admin.agent
        .delete(`/api/users/${registration.customerId}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(409);
    });

    it('does not let an admin delete their own account', async () => {
      await admin.agent
        .delete(`/api/users/${admin.userId}`)
        .set('x-csrf-token', admin.csrfToken)
        .expect(409);
    });
  });

  describe('access', () => {
    it.each(['ORGANIZER', 'CUSTOMER'] as const)('is closed to %s', async (role) => {
      const { agent, csrfToken } = await signedInAgent(app, role);
      const user = await createUser(prisma);

      await agent.get('/api/users').expect(403);
      await agent.get(`/api/users/${user.id}`).expect(403);
      await agent
        .patch(`/api/users/${user.id}`)
        .set('x-csrf-token', csrfToken)
        .send({ role: 'ADMIN' })
        .expect(403);
      await agent.delete(`/api/users/${user.id}`).set('x-csrf-token', csrfToken).expect(403);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe(
        'CUSTOMER',
      );
    });
  });
  // Last: it temporarily leaves exactly two admins in the shared test database.
  describe('concurrent role changes', () => {
    it('never leaves the system without an admin when two admins demote each other at once', async () => {
      const first = await signedInAgent(app, 'ADMIN');
      const second = await signedInAgent(app, 'ADMIN');
      const others = await prisma.user.findMany({
        where: { role: 'ADMIN', id: { notIn: [first.userId, second.userId] } },
        select: { id: true },
      });
      const otherIds = others.map((other) => other.id);
      await prisma.user.updateMany({
        where: { id: { in: otherIds } },
        data: { role: 'ORGANIZER' },
      });
      try {
        const results = await Promise.all([
          first.agent
            .patch(`/api/users/${second.userId}`)
            .set('x-csrf-token', first.csrfToken)
            .send({ role: 'CUSTOMER' }),
          second.agent
            .patch(`/api/users/${first.userId}`)
            .set('x-csrf-token', second.csrfToken)
            .send({ role: 'CUSTOMER' }),
        ]);

        // One demotion wins. The other is refused: 409 if it reached the lock, or 401/403 if the
        // winner had already demoted and signed out its author.
        const statuses = results.map((result) => result.status);
        expect(statuses.filter((status) => status === 200)).toHaveLength(1);
        expect(statuses.filter((status) => [401, 403, 409].includes(status))).toHaveLength(1);
        expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
      } finally {
        await prisma.user.updateMany({ where: { id: { in: otherIds } }, data: { role: 'ADMIN' } });
      }
    });
  });
});
