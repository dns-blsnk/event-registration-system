import { vi } from 'vitest';

/**
 * Browser-only parts of the banner field, replaced for jsdom (no image decoding, no canvas). Specs
 * call this from their own vi.mock factories, which vitest hoists above the imports.
 */
export const BANNER_MOCKS = {
  imageSizeOf: vi.fn(() => Promise.resolve({ naturalWidth: 2400, naturalHeight: 1200 })),
  cropBanner: vi.fn(() => Promise.resolve(new Blob(['cropped'], { type: 'image/jpeg' }))),
};
