import { BANNER_HEIGHT, BANNER_WIDTH } from '@ers/shared';

import { loadImage } from './read-image';

import type { Area } from 'react-easy-crop';

/**
 * JPEG, not WebP: Safari cannot encode WebP from a canvas and would fall back to a PNG that can
 * pass the size limit. The API re-encodes to WebP anyway.
 */
const OUTPUT_TYPE = 'image/jpeg';
const OUTPUT_QUALITY = 0.9;

/** Cuts the chosen area out of the image at the stored banner size. */
export async function cropBanner(src: string, area: Area): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = BANNER_WIDTH;
  canvas.height = BANNER_HEIGHT;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('The browser cannot crop images');
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    BANNER_WIDTH,
    BANNER_HEIGHT,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) reject(new Error('The image could not be cropped'));
        else resolve(blob);
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY,
    );
  });
}
