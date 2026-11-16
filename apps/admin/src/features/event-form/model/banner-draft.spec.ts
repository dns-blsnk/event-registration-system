import { BANNER_SOURCE_MAX_BYTES } from '@ers/shared';
import { describe, expect, it } from 'vitest';

import { bannerFileProblem, bannerMaxZoom, hasBannerAfter } from './banner-draft';

describe('bannerFileProblem', () => {
  it('accepts JPEG, PNG and WebP photos up to the source limit', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(bannerFileProblem({ type, size: BANNER_SOURCE_MAX_BYTES })).toBeUndefined();
    }
  });

  it('refuses other types', () => {
    expect(bannerFileProblem({ type: 'image/svg+xml', size: 10 })).toBe(
      'The image must be JPEG, PNG, WebP',
    );
  });

  it('refuses a file over the size limit', () => {
    expect(bannerFileProblem({ type: 'image/png', size: BANNER_SOURCE_MAX_BYTES + 1 })).toBe(
      'The image must be at most 25 MB',
    );
  });
});

describe('bannerMaxZoom', () => {
  it('lets a large image zoom in until the cut-out is the minimum width', () => {
    expect(bannerMaxZoom({ naturalWidth: 3600, naturalHeight: 1800 })).toBe(3);
  });

  it('measures a tall image by the widest 2:1 area it holds', () => {
    expect(bannerMaxZoom({ naturalWidth: 2400, naturalHeight: 4000 })).toBe(2);
  });

  it('measures a very wide image by its height', () => {
    expect(bannerMaxZoom({ naturalWidth: 6000, naturalHeight: 600 })).toBe(1);
  });

  it('refuses an image whose largest 2:1 area is below the minimum', () => {
    expect(bannerMaxZoom({ naturalWidth: 1199, naturalHeight: 900 })).toBeUndefined();
    expect(bannerMaxZoom({ naturalWidth: 2000, naturalHeight: 599 })).toBeUndefined();
  });
});

describe('hasBannerAfter', () => {
  it('follows the draft', () => {
    expect(hasBannerAfter({ kind: 'keep' }, true)).toBe(true);
    expect(hasBannerAfter({ kind: 'keep' }, false)).toBe(false);
    expect(hasBannerAfter({ kind: 'replace', image: new Blob(), previewUrl: 'data:' }, false)).toBe(
      true,
    );
    expect(hasBannerAfter({ kind: 'remove' }, true)).toBe(false);
  });
});
