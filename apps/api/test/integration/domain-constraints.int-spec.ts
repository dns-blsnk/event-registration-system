import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent, createRegistration, createSession } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const HOUR_MS = 3_600_000;

describe('domain tables enforce business invariants in the database', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['ends when it starts', 0],
    ['ends before it starts', -HOUR_MS],
  ])('rejects an event that %s', async (_label, offset) => {
    const start = new Date('2027-01-10T10:00:00Z');

    await expect(
      createEvent(prisma, { startsAt: start, endsAt: new Date(start.getTime() + offset) }),
    ).rejects.toThrow(/events_dates_check/);
  });

  it.each([
    ['ends when it starts', 0],
    ['ends before it starts', -HOUR_MS],
  ])('rejects a session that %s', async (_label, offset) => {
    const event = await createEvent(prisma);

    await expect(
      createSession(prisma, event, { endsAt: new Date(event.startsAt.getTime() + offset) }),
    ).rejects.toThrow(/sessions_dates_check/);
  });

  it.each([0, -5])('rejects a session with capacity %i', async (capacity) => {
    const event = await createEvent(prisma);

    await expect(createSession(prisma, event, { capacity })).rejects.toThrow(
      /sessions_capacity_check/,
    );
  });

  it('never lets confirmed seats exceed capacity or go negative', async () => {
    const event = await createEvent(prisma);
    const session = await createSession(prisma, event, { capacity: 2 });

    await expect(
      prisma.session.update({ where: { id: session.id }, data: { confirmedCount: 3 } }),
    ).rejects.toThrow(/sessions_confirmed_count_check/);
    await expect(
      prisma.session.update({ where: { id: session.id }, data: { confirmedCount: -1 } }),
    ).rejects.toThrow(/sessions_confirmed_count_check/);
  });

  it('allows only one registration per customer and session', async () => {
    const event = await createEvent(prisma);
    const session = await createSession(prisma, event);
    const first = await createRegistration(prisma, session);

    await expect(
      createRegistration(prisma, session, { customerId: first.customerId, status: 'WAITLISTED' }),
    ).rejects.toThrow();
  });

  it('refuses to delete an event whose sessions have registrations', async () => {
    const event = await createEvent(prisma);
    await createRegistration(prisma, await createSession(prisma, event));

    await expect(prisma.event.delete({ where: { id: event.id } })).rejects.toThrow();
  });

  it('deletes an event together with its sessions and tag links when nobody registered', async () => {
    const event = await createEvent(prisma);
    await createSession(prisma, event);
    const tag = await prisma.tag.create({ data: { name: `tag-${event.id.slice(0, 8)}` } });
    await prisma.eventTag.create({ data: { eventId: event.id, tagId: tag.id } });

    await prisma.event.delete({ where: { id: event.id } });

    expect(await prisma.session.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.eventTag.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.tag.count({ where: { id: tag.id } })).toBe(1);
  });

  it.each([' padded', 'padded\t', '\nnewline', ''])('rejects the tag name %p', async (name) => {
    await expect(prisma.tag.create({ data: { name } })).rejects.toThrow(/tags_name_check/);
  });

  it('rejects tag names that differ only in case', async () => {
    const name = `Case-${String(Date.now())}`;
    await prisma.tag.create({ data: { name } });

    await expect(prisma.tag.create({ data: { name: name.toLowerCase() } })).rejects.toThrow();
  });
});
