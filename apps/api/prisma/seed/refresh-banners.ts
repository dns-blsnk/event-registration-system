import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../src/config/config.module.js';
import { StorageService } from '../../src/modules/storage/storage.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

import { bannerFor, loadSeedBanners } from './banner-image.js';
import { inBatches, UPLOAD_CONCURRENCY } from './write.js';

interface Context {
  prisma: PrismaService;
  storage: StorageService;
  banners: readonly Buffer[];
}

async function replaceBanner(
  { prisma, storage, banners }: Context,
  event: { id: string; bannerKey: string | null },
): Promise<void> {
  const key = `events/${event.id}/banner-${randomUUID()}`;
  await storage.putImage(key, bannerFor(event.id, banners));
  try {
    await prisma.event.update({ where: { id: event.id }, data: { bannerKey: key } });
  } catch (error) {
    // Nothing points at the new object, so it would stay in the bucket for good.
    await storage.delete(key);
    throw error;
  }
  if (event.bannerKey === null) return;
  // The event already shows the new banner; a leftover old object only costs storage.
  await storage.delete(event.bannerKey).catch((error: unknown) => {
    // eslint-disable-next-line no-console -- command-line output
    console.warn(`Could not delete ${event.bannerKey ?? ''}:`, error);
  });
}

/**
 * `pnpm db:seed:banners`: gives every event already in the database one of the demo banners,
 * without touching any other data. Each banner gets a fresh key, as an upload does, so a cached
 * presigned link never shows a replaced file; the previous object is removed afterwards.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaService(config);
  const storage = new StorageService(config);
  try {
    const context = { prisma, storage, banners: await loadSeedBanners() };
    const events = await prisma.event.findMany({ select: { id: true, bannerKey: true } });
    await inBatches(events, UPLOAD_CONCURRENCY, async (batch) =>
      Promise.all(batch.map(async (event) => replaceBanner(context, event))),
    );
    // eslint-disable-next-line no-console -- command-line output
    console.log(`Gave ${String(events.length)} events a demo banner`);
  } finally {
    await prisma.$disconnect();
    storage.onModuleDestroy();
  }
}

await main();
