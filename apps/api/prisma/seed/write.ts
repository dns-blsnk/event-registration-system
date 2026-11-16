import { bannerPng, colourFor } from './banner-image.js';

import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { StorageService } from '../../src/modules/storage/storage.service.js';
import type { SeedPlan } from './generate.js';

/** Small enough that one insert stays well inside the database statement timeout. */
const BATCH_SIZE = 1000;
/** The whole write is one transaction, so a failure leaves the database empty and re-runnable. */
const TRANSACTION_TIMEOUT_MS = 300_000;
const UPLOAD_CONCURRENCY = 16;

export interface SeedSummary {
  users: number;
  events: number;
  sessions: number;
  registrations: number;
  banners: number;
}

async function inBatches<T>(
  rows: readonly T[],
  size: number,
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += size) {
    await write(rows.slice(start, start + size));
  }
}

async function uploadBanners(
  storage: StorageService,
  plan: SeedPlan,
): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  await inBatches(plan.events, UPLOAD_CONCURRENCY, async (batch) =>
    Promise.all(
      batch.map(async (event) => {
        const key = `events/${event.id}/banner-seed`;
        await storage.putImage(key, bannerPng(colourFor(event.id)));
        keys.set(event.id, key);
      }),
    ),
  );
  return keys;
}

/**
 * Writes a generated plan into an empty database: banners first (so every stored key exists),
 * then rows in batches in dependency order. Only demo accounts get the password hash.
 */
export async function writeSeedPlan(
  { prisma, storage }: { prisma: PrismaClient; storage: StorageService },
  { plan, demoPasswordHash }: { plan: SeedPlan; demoPasswordHash: string },
): Promise<SeedSummary> {
  const bannerKeys = await uploadBanners(storage, plan);
  await prisma.$transaction(
    async (tx) => {
      await inBatches(plan.users, BATCH_SIZE, async (batch) =>
        tx.user.createMany({
          data: batch.map(({ isDemo, ...user }) => ({
            ...user,
            passwordHash: isDemo ? demoPasswordHash : null,
          })),
        }),
      );
      await tx.tag.createMany({ data: plan.tags });
      await inBatches(plan.events, BATCH_SIZE, async (batch) =>
        tx.event.createMany({
          data: batch.map((event) => ({
            id: event.id,
            title: event.title,
            slug: event.slug,
            description: event.description,
            venue: event.venue,
            city: event.city,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            status: event.status,
            organizerId: event.organizerId,
            createdAt: event.createdAt,
            bannerKey: bannerKeys.get(event.id) ?? null,
          })),
        }),
      );
      await tx.eventTag.createMany({
        data: plan.events.flatMap((event) =>
          event.tagIds.map((tagId) => ({ eventId: event.id, tagId })),
        ),
      });
      await inBatches(plan.sessions, BATCH_SIZE, async (batch) =>
        tx.session.createMany({ data: batch }),
      );
      await inBatches(plan.registrations, BATCH_SIZE, async (batch) =>
        tx.registration.createMany({ data: batch }),
      );
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
  return {
    users: plan.users.length,
    events: plan.events.length,
    sessions: plan.sessions.length,
    registrations: plan.registrations.length,
    banners: bannerKeys.size,
  };
}
