import type { BannerMimeType } from '@ers/shared';

const JPEG_SIGNATURE = Buffer.from('ffd8ff', 'hex');
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
/** WebP is a RIFF container: "RIFF", four size bytes, then "WEBP". */
const RIFF_SIGNATURE = Buffer.from('RIFF', 'ascii');
const WEBP_SIGNATURE = Buffer.from('WEBP', 'ascii');
const WEBP_SIGNATURE_OFFSET = 8;

function startsWith(bytes: Uint8Array, signature: Uint8Array, offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The real image type from the file's first bytes (magic numbers). The client's file name and
 * Content-Type are never trusted: a renamed HTML or SVG file must not be stored as an image.
 */
export function detectImageType(bytes: Uint8Array): BannerMimeType | undefined {
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (
    startsWith(bytes, RIFF_SIGNATURE) &&
    startsWith(bytes, WEBP_SIGNATURE, WEBP_SIGNATURE_OFFSET)
  ) {
    return 'image/webp';
  }
  return undefined;
}
