import { randomUUID } from 'node:crypto';

import { CSRF_HEADER, MAX_PINNED_EVENTS } from '@ers/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const DAY_MS = 86_400_000;

describe('pinned events API', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  function pin(staff: SignedInAgent, eventId: string): request.Test {
    return staff.agent.put(`/api/pinned-events/${eventId}`).set(CSRF_HEADER, staff.csrfToken);
  }

  function unpin(staff: SignedInAgent, eventId: string): request.Test {
    return staff.agent.delete(`/api/pinned-events/${eventId}`).set(CSRF_HEADER, staff.csrfToken);
  }

  it('pins an organizer’s own event and lists it with its seats and status', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    await pin(organizer, event.id).expect(204);
    const response = await organizer.agent.get('/api/pinned-events').expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: event.id, status: 'PUBLISHED', fillRate: 0 }),
    ]);
    expect(response.headers['x-total-count']).toBe('1');
  });

  it('lists pinned events soonest first', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const later = await createEvent(prisma, {
      organizerId: organizer.userId,
      startsAt: new Date(Date.now() + 20 * DAY_MS),
    });
    const sooner = await createEvent(prisma, {
      organizerId: organizer.userId,
      startsAt: new Date(Date.now() + 2 * DAY_MS),
    });
    await pin(organizer, later.id).expect(204);
    await pin(organizer, sooner.id).expect(204);

    const response = await organizer.agent.get('/api/pinned-events').expect(200);

    expect(response.body.map((event: { id: string }) => event.id)).toEqual([sooner.id, later.id]);
  });

  it('treats pinning twice as one pin', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    await pin(organizer, event.id).expect(204);
    await pin(organizer, event.id).expect(204);

    expect(await prisma.pinnedEvent.count({ where: { userId: organizer.userId } })).toBe(1);
  });

  it('keeps pins per person', async () => {
    const admin = await signedInAgent(app, 'ADMIN');
    const other = await signedInAgent(app, 'ADMIN');
    const event = await createEvent(prisma);
    await pin(admin, event.id).expect(204);

    const response = await other.agent.get('/api/pinned-events').expect(200);

    expect(response.body).toEqual([]);
  });

  it('lets an admin pin any event', async () => {
    const admin = await signedInAgent(app, 'ADMIN');
    const event = await createEvent(prisma);

    await pin(admin, event.id).expect(204);
  });

  it('refuses another organizer’s event as not found', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const foreign = await createEvent(prisma);

    const response = await pin(organizer, foreign.id).expect(404);

    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('refuses an event that does not exist, and an id that is not a uuid', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');

    await pin(organizer, randomUUID()).expect(404);
    await pin(organizer, 'not-a-uuid').expect(400);
  });

  it(`stops at ${String(MAX_PINNED_EVENTS)} pins`, async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const events = await Promise.all(
      Array.from({ length: MAX_PINNED_EVENTS + 1 }, () =>
        createEvent(prisma, { organizerId: organizer.userId }),
      ),
    );
    for (const event of events.slice(0, MAX_PINNED_EVENTS)) {
      await pin(organizer, event.id).expect(204);
    }

    const response = await pin(organizer, events.at(-1)?.id ?? '').expect(409);

    expect(response.body.code).toBe('CONFLICT');
  });

  it('unpins, and unpinning what is not pinned changes nothing', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const event = await createEvent(prisma, { organizerId: organizer.userId });
    await pin(organizer, event.id).expect(204);

    await unpin(organizer, event.id).expect(204);
    await unpin(organizer, event.id).expect(204);

    expect((await organizer.agent.get('/api/pinned-events').expect(200)).body).toEqual([]);
  });

  it('drops the pin when the event is deleted', async () => {
    const admin = await signedInAgent(app, 'ADMIN');
    const event = await createEvent(prisma);
    await pin(admin, event.id).expect(204);

    await prisma.event.delete({ where: { id: event.id } });

    expect(await prisma.pinnedEvent.count({ where: { eventId: event.id } })).toBe(0);
  });

  it('is for staff only', async () => {
    const customer = await signedInAgent(app, 'CUSTOMER');
    const event = await createEvent(prisma);

    await customer.agent.get('/api/pinned-events').expect(403);
    await pin(customer, event.id).expect(403);
    await unpin(customer, event.id).expect(403);
  });

  it('needs a session and the CSRF token', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    await request(app.getHttpServer()).get('/api/pinned-events').expect(401);
    await organizer.agent.put(`/api/pinned-events/${event.id}`).expect(403);
    await organizer.agent.delete(`/api/pinned-events/${event.id}`).expect(403);
  });

  it('does not count pins the user can no longer see against the limit', async () => {
    const staff = await signedInAgent(app, 'ADMIN');
    const foreign = await Promise.all(
      Array.from({ length: MAX_PINNED_EVENTS }, () => createEvent(prisma)),
    );
    for (const event of foreign) await pin(staff, event.id).expect(204);
    // Now an organizer: none of those events are theirs any more.
    await prisma.user.update({ where: { id: staff.userId }, data: { role: 'ORGANIZER' } });
    const own = await createEvent(prisma, { organizerId: staff.userId });

    await pin(staff, own.id).expect(204);
    const response = await staff.agent.get('/api/pinned-events').expect(200);

    expect(response.body.map((event: { id: string }) => event.id)).toEqual([own.id]);
  });

  it('lets two requests pin the same event at once', async () => {
    const organizer = await signedInAgent(app, 'ORGANIZER');
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    const [first, second] = await Promise.all([pin(organizer, event.id), pin(organizer, event.id)]);

    expect([first.status, second.status]).toEqual([204, 204]);
  });
});
