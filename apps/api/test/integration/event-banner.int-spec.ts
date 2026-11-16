import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { StorageService } from '../../src/modules/storage/storage.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, type SignedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createEvent, createRegistration, createSession } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex');
const HTTP_NOT_FOUND = 404;

describe('event banner', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let admin: SignedInAgent;
  let organizer: SignedInAgent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    admin = await signedInAgent(app, 'ADMIN');
    organizer = await signedInAgent(app, 'ORGANIZER');
  });

  afterAll(async () => {
    await app.close();
  });

  async function upload(
    agent: SignedInAgent,
    eventId: string,
    content: Buffer,
    expected: number,
    name = 'banner.png',
  ) {
    return agent.agent
      .put(`/api/events/${eventId}/banner`)
      .set('x-csrf-token', agent.csrfToken)
      .attach('file', content, name)
      .expect(expected);
  }

  async function keyOf(eventId: string): Promise<string | null> {
    return (await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).bannerKey;
  }

  async function exists(key: string): Promise<boolean> {
    return (await fetch(await storage.presignedGetUrl(key))).status !== HTTP_NOT_FOUND;
  }

  it('uploads a banner and returns a working link in the event', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    await upload(organizer, event.id, PNG, 204);
    const response = await organizer.agent.get(`/api/events/${event.id}`).expect(200);
    const image = await fetch(response.body.bannerUrl as string);

    expect(image.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await image.arrayBuffer())).toEqual(PNG);
  });

  it('replaces a banner and removes the previous file', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });
    await upload(organizer, event.id, PNG, 204);
    const first = await keyOf(event.id);

    await upload(organizer, event.id, JPEG, 204, 'banner.jpg');
    const second = await keyOf(event.id);

    expect(second).not.toBe(first);
    expect(await exists(first ?? '')).toBe(false);
    expect(await exists(second ?? '')).toBe(true);
  });

  it('removes a banner', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });
    await upload(organizer, event.id, PNG, 204);
    const key = await keyOf(event.id);

    await organizer.agent
      .delete(`/api/events/${event.id}/banner`)
      .set('x-csrf-token', organizer.csrfToken)
      .expect(204);

    expect(await keyOf(event.id)).toBeNull();
    expect(await exists(key ?? '')).toBe(false);
    expect(
      (await organizer.agent.get(`/api/events/${event.id}`).expect(200)).body.bannerUrl,
    ).toBeNull();
  });

  it('rejects a file that is not a real image, whatever its name, and stores nothing', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    const response = await upload(
      organizer,
      event.id,
      Buffer.from('<svg onload="alert(1)"></svg>'),
      415,
      'banner.png',
    );

    expect(response.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await keyOf(event.id)).toBeNull();
  });

  it('rejects a file over the size limit', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });
    const oversized = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);

    const response = await upload(organizer, event.id, oversized, 413);

    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('asks for the file when it is missing', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    const response = await organizer.agent
      .put(`/api/events/${event.id}/banner`)
      .set('x-csrf-token', organizer.csrfToken)
      .expect(400);

    expect(response.body.details[0].field).toBe('file');
  });

  it('rejects extra form fields next to the file', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    await organizer.agent
      .put(`/api/events/${event.id}/banner`)
      .set('x-csrf-token', organizer.csrfToken)
      .field('note', 'x'.repeat(1000))
      .attach('file', PNG, 'banner.png')
      .expect(400);

    expect(await keyOf(event.id)).toBeNull();
  });

  it("answers 404 for another organizer's event and stores nothing", async () => {
    const event = await createEvent(prisma);

    await upload(organizer, event.id, PNG, 404);

    expect(await keyOf(event.id)).toBeNull();
  });

  it('refuses a new banner for a cancelled event', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId, status: 'CANCELLED' });

    await upload(organizer, event.id, PNG, 409);

    expect(await keyOf(event.id)).toBeNull();
  });

  it('is closed to customers', async () => {
    const customer = await signedInAgent(app);
    const event = await createEvent(prisma);

    await upload(customer, event.id, PNG, 403);
    await customer.agent
      .delete(`/api/events/${event.id}/banner`)
      .set('x-csrf-token', customer.csrfToken)
      .expect(403);
  });

  it("answers 404 when removing another organizer's banner and keeps it", async () => {
    const event = await createEvent(prisma);
    await upload(admin, event.id, PNG, 204);

    await organizer.agent
      .delete(`/api/events/${event.id}/banner`)
      .set('x-csrf-token', organizer.csrfToken)
      .expect(404);

    expect(await keyOf(event.id)).not.toBeNull();
  });

  it('lets staff take a banner off a cancelled event', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });
    await upload(organizer, event.id, PNG, 204);
    await prisma.event.update({ where: { id: event.id }, data: { status: 'CANCELLED' } });

    await organizer.agent
      .delete(`/api/events/${event.id}/banner`)
      .set('x-csrf-token', organizer.csrfToken)
      .expect(204);

    expect(await keyOf(event.id)).toBeNull();
  });

  it('removing a banner that does not exist changes nothing', async () => {
    const event = await createEvent(prisma, { organizerId: organizer.userId });

    await organizer.agent
      .delete(`/api/events/${event.id}/banner`)
      .set('x-csrf-token', organizer.csrfToken)
      .expect(204);

    const after = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.updatedAt).toEqual(event.updatedAt);
  });

  it('deletes the banner file together with the event', async () => {
    const event = await createEvent(prisma);
    await upload(admin, event.id, PNG, 204);
    const key = await keyOf(event.id);

    await admin.agent
      .delete(`/api/events/${event.id}`)
      .set('x-csrf-token', admin.csrfToken)
      .expect(204);

    expect(await exists(key ?? '')).toBe(false);
  });

  it('keeps the banner when the event cannot be deleted', async () => {
    const event = await createEvent(prisma);
    await createRegistration(prisma, await createSession(prisma, event));
    await upload(admin, event.id, PNG, 204);
    const key = await keyOf(event.id);

    await admin.agent
      .delete(`/api/events/${event.id}`)
      .set('x-csrf-token', admin.csrfToken)
      .expect(409);

    expect(await exists(key ?? '')).toBe(true);
  });
});
