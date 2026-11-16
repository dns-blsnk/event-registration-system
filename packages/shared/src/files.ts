const BYTES_PER_MEBIBYTE = 1_048_576;
/** Banner size limit in MiB, for messages; BANNER_MAX_BYTES is what code compares against. */
export const BANNER_MAX_MEBIBYTES = 5;

/** Largest banner image the API accepts, in bytes. */
export const BANNER_MAX_BYTES = BANNER_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE;

/** Image types accepted for banners; the API checks the real type from the file's first bytes. */
export const BANNER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type BannerMimeType = (typeof BANNER_MIME_TYPES)[number];

/** Human names of the accepted banner types, for help texts and errors. */
export const BANNER_TYPE_LABELS: Readonly<Record<BannerMimeType, string>> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
};
