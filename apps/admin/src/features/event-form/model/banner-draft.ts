import {
  BANNER_ASPECT_RATIO,
  BANNER_MIME_TYPES,
  BANNER_MIN_WIDTH,
  BANNER_SOURCE_MAX_BYTES,
  BANNER_SOURCE_MAX_MEBIBYTES,
  BANNER_TYPE_LABELS,
} from '@ers/shared';

/**
 * What happens to the banner when the form is saved; nothing is sent before that. A new image
 * carries a data URL for its preview, which needs no cleanup, unlike an object URL.
 */
export type BannerDraft =
  { kind: 'keep' } | { kind: 'replace'; image: Blob; previewUrl: string } | { kind: 'remove' };

export const KEEP_BANNER: BannerDraft = { kind: 'keep' };

const TYPE_NAMES = Object.values(BANNER_TYPE_LABELS).join(', ');

function isBannerType(type: string): boolean {
  return (BANNER_MIME_TYPES as readonly string[]).includes(type);
}

/**
 * Why a picked photo cannot be framed, before it is even opened. Its limit is the source one:
 * only the framed crop is uploaded, and the API checks that again.
 */
export function bannerFileProblem(file: { type: string; size: number }): string | undefined {
  if (!isBannerType(file.type)) return `The image must be ${TYPE_NAMES}`;
  if (file.size > BANNER_SOURCE_MAX_BYTES) {
    return `The image must be at most ${String(BANNER_SOURCE_MAX_MEBIBYTES)} MB`;
  }
  return undefined;
}

/**
 * How far the cropper may zoom in, so the cut-out 2:1 area keeps at least the minimum width of
 * real pixels; undefined when even the largest 2:1 area of the image is too small.
 */
export function bannerMaxZoom(image: {
  naturalWidth: number;
  naturalHeight: number;
}): number | undefined {
  const largestWidth = Math.min(image.naturalWidth, image.naturalHeight * BANNER_ASPECT_RATIO);
  return largestWidth < BANNER_MIN_WIDTH ? undefined : largestWidth / BANNER_MIN_WIDTH;
}

/** Whether the event will have a banner once this draft is saved. */
export function hasBannerAfter(draft: BannerDraft, hasBannerNow: boolean): boolean {
  switch (draft.kind) {
    case 'keep':
      return hasBannerNow;
    case 'replace':
      return true;
    case 'remove':
      return false;
  }
}
