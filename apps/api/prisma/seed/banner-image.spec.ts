import { BANNER_HEIGHT, BANNER_WIDTH } from '@ers/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { detectImageType } from '../../src/modules/storage/image-type.js';

import { bannerFor, loadSeedBanners } from './banner-image.js';

describe('loadSeedBanners', () => {
  it('re-encodes every shipped banner to the stored WebP size', async () => {
    const banners = await loadSeedBanners();

    expect(banners).toHaveLength(10);
    for (const banner of banners) {
      expect(detectImageType(banner)).toBe('image/webp');
      const { width, height } = await sharp(banner).metadata();
      expect([width, height]).toEqual([BANNER_WIDTH, BANNER_HEIGHT]);
    }
  });
});

describe('bannerFor', () => {
  const banners = ['a', 'b', 'c', 'd', 'e'];

  it('gives the same banner for the same id', () => {
    expect(bannerFor('event-1', banners)).toBe(bannerFor('event-1', banners));
  });

  it('spreads ids over all the banners', () => {
    const picked = new Set(
      Array.from({ length: 100 }, (_, index) => bannerFor(`event-${String(index)}`, banners)),
    );
    expect(picked.size).toBe(banners.length);
  });

  it('refuses to pick from an empty list', () => {
    expect(() => bannerFor('event-1', [])).toThrow();
  });
});
