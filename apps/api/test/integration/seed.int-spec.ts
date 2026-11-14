import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateSeedPlan, type SeedPlan } from '../../prisma/seed/generate.js';
import { writeSeedPlan } from '../../prisma/seed/write.js';
import { PasswordService } from '../../src/modules/auth/password.service.js';
import { StorageService } from '../../src/modules/storage/storage.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

const DEMO_PASSWORD = 'seed demo password';
const SIZES = {
  organizers: 2,
  customers: 20,
  events: 6,
  sessionsPerEvent: 3,
  registrations: 60,
  tags: 4,
};

describe('demo data seed', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let plan: SeedPlan;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    // The test database is shared and long-lived: a fixed seed for reproducible failures, with
    // fresh ids and unique emails, slugs and tag names so repeated runs never clash.
    const generated = generateSeedPlan({ seed: 11, now: new Date(), sizes: SIZES });
    const freshIds = new Map<string, string>();
    const fresh = (id: string): string => {
      const known = freshIds.get(id) ?? randomUUID();
      freshIds.set(id, known);
      return known;
    };
    plan = {
      users: generated.users.map((user) => ({
        ...user,
        id: fresh(user.id),
        email: `seed-${randomUUID()}@test.local`,
      })),
      tags: generated.tags.map((tag) => ({
        id: fresh(tag.id),
        name: `${tag.name} ${randomUUID().slice(0, 8)}`,
      })),
      events: generated.events.map((event) => ({
        ...event,
        id: fresh(event.id),
        organizerId: fresh(event.organizerId),
        tagIds: event.tagIds.map(fresh),
        slug: `${event.slug}-${randomUUID()}`,
      })),
      sessions: generated.sessions.map((session) => ({
        ...session,
        id: fresh(session.id),
        eventId: fresh(session.eventId),
      })),
      registrations: generated.registrations.map((registration) => ({
        ...registration,
        id: fresh(registration.id),
        sessionId: fresh(registration.sessionId),
        customerId: fresh(registration.customerId),
      })),
    };
    const demoPasswordHash = await app.get(PasswordService).hash(DEMO_PASSWORD);
    await writeSeedPlan({ prisma, storage }, { plan, demoPasswordHash });
  });

  afterAll(async () => {
    await app.close();
  });

  it('writes every planned row with exact seat counters', async () => {
    const ids = plan.sessions.map((session) => session.id);
    const sessions = await prisma.session.findMany({
      where: { id: { in: ids } },
      include: { registrations: true },
    });

    expect(sessions).toHaveLength(plan.sessions.length);
    for (const session of sessions) {
      const taken = session.registrations.filter(
        (r) => r.status === 'CONFIRMED' || r.status === 'ATTENDED',
      ).length;
      expect(session.confirmedCount).toBe(taken);
    }
    expect(await prisma.registration.count({ where: { sessionId: { in: ids } } })).toBe(
      plan.registrations.length,
    );
  });

  it('gives every event a stored banner image', async () => {
    const events = await prisma.event.findMany({
      where: { id: { in: plan.events.map((event) => event.id) } },
    });

    for (const event of events) {
      expect(event.bannerKey).not.toBeNull();
      const image = await fetch(await storage.presignedGetUrl(event.bannerKey ?? ''));
      expect(image.headers.get('content-type')).toBe('image/png');
    }
  });

  it('lets each demo account sign in and keeps generated people without a password', async () => {
    for (const demo of plan.users.filter((user) => user.isDemo)) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: demo.email, password: DEMO_PASSWORD })
        .expect(200);
      expect(response.body.user.role).toBe(demo.role);
    }
    const generated = plan.users.find((user) => !user.isDemo);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: generated?.id ?? '' } })).passwordHash,
    ).toBeNull();
  });
});
