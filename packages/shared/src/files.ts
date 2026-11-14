const BYTES_PER_MEBIBYTE = 1_048_576;
const BANNER_MAX_MEBIBYTES = 5;

/** Largest banner image the API accepts, in bytes. */
export const BANNER_MAX_BYTES = BANNER_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE;

/** Image types accepted for banners; the API checks the real type from the file's first bytes. */
export const BANNER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type BannerMimeType = (typeof BANNER_MIME_TYPES)[number];
