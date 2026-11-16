import {
  BANNER_FILE_FIELD,
  BANNER_HEIGHT,
  BANNER_MAX_MEGAPIXELS,
  BANNER_MIN_HEIGHT,
  BANNER_MIN_WIDTH,
  BANNER_TOO_SMALL_MESSAGE,
  BANNER_WIDTH,
} from '@ers/shared';
import sharp, { type Metadata } from 'sharp';

import { fieldError } from '../../../common/errors/field-error.js';
import { detectImageType, unsupportedImageError } from '../../storage/index.js';

const PIXELS_PER_MEGAPIXEL = 1_000_000;
/**
 * Refuses images that decode to more pixels than this: a small, highly compressed file could
 * otherwise expand to gigabytes in memory.
 */
const MAX_INPUT_PIXELS = BANNER_MAX_MEGAPIXELS * PIXELS_PER_MEGAPIXEL;
const TOO_LARGE_MESSAGE = `The image has too many pixels: use at most ${String(BANNER_MAX_MEGAPIXELS)} megapixels`;
const WEBP_QUALITY = 82;
/** EXIF orientations 5 to 8 turn the picture by 90°, so its width and height swap. */
const FIRST_SIDEWAYS_ORIENTATION = 5;

/**
 * Turns an uploaded image into the stored banner: a 2160 × 1080 WebP cut from its centre. Writing
 * a new file means only pixels are kept: camera metadata (location included) is dropped, and
 * anything hidden in the upload besides the picture does not survive. The type is checked from
 * the bytes first, so only JPEG, PNG and WebP ever reach the decoder.
 */
export async function toStoredBanner(upload: Uint8Array): Promise<Buffer> {
  if (detectImageType(upload) === undefined) throw unsupportedImageError();
  let metadata: Metadata;
  try {
    // Only the header is read here, so no limit is needed yet; the size is judged right below.
    metadata = await sharp(upload, { limitInputPixels: false }).metadata();
  } catch (error) {
    throw unsupportedImageError(error);
  }
  const isSideways = (metadata.orientation ?? 1) >= FIRST_SIDEWAYS_ORIENTATION;
  const width = isSideways ? metadata.height : metadata.width;
  const height = isSideways ? metadata.width : metadata.height;
  if (width < BANNER_MIN_WIDTH || height < BANNER_MIN_HEIGHT) {
    throw fieldError(BANNER_FILE_FIELD, BANNER_TOO_SMALL_MESSAGE);
  }
  if (width * height > MAX_INPUT_PIXELS) {
    throw fieldError(BANNER_FILE_FIELD, TOO_LARGE_MESSAGE);
  }
  try {
    // The limit stays on the decoder too, in case the header understated the size.
    return await sharp(upload, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(BANNER_WIDTH, BANNER_HEIGHT, { fit: 'cover', position: 'centre' })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (error) {
    throw unsupportedImageError(error);
  }
}
