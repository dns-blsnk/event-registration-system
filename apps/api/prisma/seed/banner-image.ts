import { crc32, deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const WIDTH = 64;
const HEIGHT = 24;
const BIT_DEPTH = 8;
const COLOR_TYPE_RGB = 2;
const BYTES_PER_PIXEL = 3;
/** Each PNG scanline starts with a filter byte; 0 means "none". */
const FILTER_NONE = 0;

function chunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/**
 * A small two-tone PNG banner in the given colour, so seeded events show real images that pass
 * the same magic-byte check as uploads, without shipping binary files in the repository.
 */
export function bannerPng(rgb: readonly [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.writeUInt8(BIT_DEPTH, 8);
  header.writeUInt8(COLOR_TYPE_RGB, 9);
  const rows = Array.from({ length: HEIGHT }, (_, y) => {
    const row = Buffer.alloc(1 + WIDTH * BYTES_PER_PIXEL);
    row.writeUInt8(FILTER_NONE, 0);
    // The lower half is darker, which reads as a simple banner rather than a flat swatch.
    const shade = y < HEIGHT / 2 ? 1 : 0.6;
    for (let x = 0; x < WIDTH; x += 1) {
      rgb.forEach((channel, index) => {
        row.writeUInt8(Math.round(channel * shade), 1 + x * BYTES_PER_PIXEL + index);
      });
    }
    return row;
  });
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A stable colour per event id, so re-seeding gives every event the same banner. */
export function colourFor(id: string): [number, number, number] {
  const hash = crc32(id);
  return [hash & 0xff, (hash >> 8) & 0xff, (hash >> 16) & 0xff];
}
