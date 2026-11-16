const BYTES_PER_MEBIBYTE = 1_048_576;
/** Banner size limit in MiB, for messages; BANNER_MAX_BYTES is what code compares against. */
export const BANNER_MAX_MEBIBYTES = 5;

/** Largest banner image the API accepts, in bytes. */
export const BANNER_MAX_BYTES = BANNER_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE;

/** The multipart field the banner upload is sent in. */
export const BANNER_FILE_FIELD = 'file';

/** Image types accepted for banners; the API checks the real type from the file's first bytes. */
export const BANNER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type BannerMimeType = (typeof BANNER_MIME_TYPES)[number];

/** Human names of the accepted banner types, for help texts and errors. */
export const BANNER_TYPE_LABELS: Readonly<Record<BannerMimeType, string>> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
};

/** Banners are stored at exactly this size (2:1, as Eventbrite uses); the API re-encodes to it. */
export const BANNER_WIDTH = 2160;
export const BANNER_HEIGHT = 1080;
export const BANNER_ASPECT_RATIO = BANNER_WIDTH / BANNER_HEIGHT;

/** The smallest 2:1 area an uploaded image must offer; anything smaller looks blurry when stretched. */
export const BANNER_MIN_WIDTH = 1200;
export const BANNER_MIN_HEIGHT = BANNER_MIN_WIDTH / BANNER_ASPECT_RATIO;

/** Largest picture the API decodes, in megapixels (about 8000 × 5000). */
export const BANNER_MAX_MEGAPIXELS = 40;

/** Says the image is too small, with the sizes the editor and the API both use. */
export const BANNER_TOO_SMALL_MESSAGE = `The image is too small: use at least ${String(BANNER_MIN_WIDTH)} × ${String(BANNER_MIN_HEIGHT)} pixels`;
