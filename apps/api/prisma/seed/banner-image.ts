import { readdir, readFile } from 'node:fs/promises';
import { crc32 } from 'node:zlib';

import { toStoredBanner } from '../../src/modules/events/banner/banner-image.js';

const BANNER_DIR = new URL('./banners/', import.meta.url);
const BANNER_EXTENSION = '.webp';

/**
 * The demo banners shipped with the seed, sorted by file name so the order never depends on the
 * file system. Each goes through the same re-encoding as an upload, so it is stored at the size
 * and format every other banner has.
 */
export async function loadSeedBanners(): Promise<Buffer[]> {
  const names = (await readdir(BANNER_DIR)).filter((name) => name.endsWith(BANNER_EXTENSION));
  return Promise.all(
    names.sort().map(async (name) => toStoredBanner(await readFile(new URL(name, BANNER_DIR)))),
  );
}

/** A random-looking but stable pick per event id, so re-seeding gives every event the same banner. */
export function bannerFor<T>(id: string, banners: readonly T[]): T {
  const banner = banners[crc32(id) % banners.length];
  if (banner === undefined) {
    throw new Error('There are no seed banners to choose from');
  }
  return banner;
}
