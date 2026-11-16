import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

describe('tags API', () => {
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

  function uniqueName(prefix = 'tag'): string {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }

  async function create(name: unknown, expected = 201) {
    return admin.agent
      .post('/api/tags')
      .set('x-csrf-token', admin.csrfToken)
      .send({ name })
      .expect(expected);
  }

  it('creates a tag with a trimmed name', async () => {
    const name = uniqueName();

    const response = await create(`  ${name}  `);

    expect(response.body).toEqual({ id: expect.any(String), name, eventCount: 0 });
  });

  it('refuses a duplicate name, ignoring case', async () => {
    const name = uniqueName('Music');
    await create(name);

    const response = await create(name.toUpperCase(), 409);

    expect(response.body.details).toEqual([
      { field: 'name', messages: ['A tag with this name already exists'] },
    ]);
  });

  it.each([
    ['empty', '   '],
    ['too long', 'x'.repeat(51)],
    ['not a string', 42],
  ])('rejects a name that is %s', async (_label, name) => {
    const response = await create(name, 400);

    expect(response.body.details[0].field).toBe('name');
  });

  it('lists tags with how many events use them and searches by name', async () => {
    const name = uniqueName('search');
    const tag = await prisma.tag.create({ data: { name } });
    const event = await createEvent(prisma);
    await prisma.eventTag.create({ data: { eventId: event.id, tagId: tag.id } });

    const response = await organizer.agent.get('/api/tags').query({ q: name }).expect(200);

    expect(response.body).toEqual([{ id: tag.id, name, eventCount: 1 }]);
  });

  it('renames a tag', async () => {
    const tag = await prisma.tag.create({ data: { name: uniqueName() } });
    const name = uniqueName('renamed');

    const response = await admin.agent
      .patch(`/api/tags/${tag.id}`)
      .set('x-csrf-token', admin.csrfToken)
      .send({ name })
      .expect(200);

    expect(response.body.name).toBe(name);
  });

  it('deletes a tag and only untags its events', async () => {
    const tag = await prisma.tag.create({ data: { name: uniqueName() } });
    const event = await createEvent(prisma);
    await prisma.eventTag.create({ data: { eventId: event.id, tagId: tag.id } });

    await admin.agent
      .delete(`/api/tags/${tag.id}`)
      .set('x-csrf-token', admin.csrfToken)
      .expect(204);

    expect(await prisma.event.count({ where: { id: event.id } })).toBe(1);
    expect(await prisma.eventTag.count({ where: { tagId: tag.id } })).toBe(0);
  });

  it('answers 404 for an unknown tag', async () => {
    const id = randomUUID();

    await organizer.agent.get(`/api/tags/${id}`).expect(404);
    const renamed = await admin.agent
      .patch(`/api/tags/${id}`)
      .set('x-csrf-token', admin.csrfToken)
      .send({ name: uniqueName() })
      .expect(404);
    const deleted = await admin.agent
      .delete(`/api/tags/${id}`)
      .set('x-csrf-token', admin.csrfToken)
      .expect(404);

    expect([renamed.body.message, deleted.body.message]).toEqual([
      'Tag not found',
      'Tag not found',
    ]);
  });

  it('lets organizers read tags but not manage them', async () => {
    const tag = await prisma.tag.create({ data: { name: uniqueName() } });

    await organizer.agent.get(`/api/tags/${tag.id}`).expect(200);
    await organizer.agent
      .post('/api/tags')
      .set('x-csrf-token', organizer.csrfToken)
      .send({ name: uniqueName() })
      .expect(403);
    await organizer.agent
      .patch(`/api/tags/${tag.id}`)
      .set('x-csrf-token', organizer.csrfToken)
      .send({ name: 'x' })
      .expect(403);
    await organizer.agent
      .delete(`/api/tags/${tag.id}`)
      .set('x-csrf-token', organizer.csrfToken)
      .expect(403);
  });

  it('is closed to customers', async () => {
    const customer = await signedInAgent(app);
    const tag = await prisma.tag.create({ data: { name: uniqueName() } });

    await customer.agent.get('/api/tags').expect(403);
    await customer.agent.get(`/api/tags/${tag.id}`).expect(403);
    await customer.agent
      .post('/api/tags')
      .set('x-csrf-token', customer.csrfToken)
      .send({ name: uniqueName() })
      .expect(403);
    await customer.agent
      .patch(`/api/tags/${tag.id}`)
      .set('x-csrf-token', customer.csrfToken)
      .send({ name: 'x' })
      .expect(403);
    await customer.agent
      .delete(`/api/tags/${tag.id}`)
      .set('x-csrf-token', customer.csrfToken)
      .expect(403);
  });
});
