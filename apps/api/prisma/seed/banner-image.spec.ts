import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { detectImageType } from '../../src/modules/storage/image-type.js';

import { bannerPng, colourFor } from './banner-image.js';

describe('bannerPng', () => {
  const png = bannerPng([200, 100, 50]);

  it('passes the upload magic-byte check as a PNG', () => {
    expect(detectImageType(png)).toBe('image/png');
  });

  it('holds 64x32 (2:1) RGB pixels in the requested colour', () => {
    expect(png.readUInt32BE(16)).toBe(64);
    expect(png.readUInt32BE(20)).toBe(32);
    const idatLength = png.readUInt32BE(33);
    const pixels = inflateSync(png.subarray(41, 41 + idatLength));
    expect(pixels.length).toBe(32 * (1 + 64 * 3));
    expect([...pixels.subarray(1, 4)]).toEqual([200, 100, 50]);
  });

  it('ends with the IEND chunk', () => {
    expect(png.subarray(-8, -4).toString('ascii')).toBe('IEND');
  });
});

describe('colourFor', () => {
  it('gives the same colour for the same id and different ones for different ids', () => {
    expect(colourFor('a')).toEqual(colourFor('a'));
    expect(colourFor('a')).not.toEqual(colourFor('b'));
  });
});
