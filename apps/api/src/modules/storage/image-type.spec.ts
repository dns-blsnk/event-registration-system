import { describe, expect, it } from 'vitest';

import { detectImageType } from './image-type.js';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const ascii = (text: string): number[] => Array.from(Buffer.from(text, 'ascii'));

describe('detectImageType', () => {
  it('recognises JPEG', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe('image/jpeg');
  });

  it('recognises PNG', () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe(
      'image/png',
    );
  });

  it('recognises WebP', () => {
    expect(
      detectImageType(bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WEBPVP8 '))),
    ).toBe('image/webp');
  });

  it.each([
    ['an HTML file renamed to .png', ascii('<html><script>')],
    ['an SVG image', ascii('<svg xmlns=')],
    ['a GIF', ascii('GIF89a')],
    ['a RIFF file that is not WebP', [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')]],
    ['a truncated PNG header', [0x89, 0x50, 0x4e]],
    ['an empty file', []],
  ])('rejects %s', (_label, content) => {
    expect(detectImageType(Uint8Array.from(content))).toBeUndefined();
  });
});
