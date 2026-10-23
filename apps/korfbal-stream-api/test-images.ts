import {deflateSync} from 'node:zlib';

/** Test images built byte by byte: small valid PNGs, a decompression bomb, broken data. */

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A PNG of `width`×`height`, 8 bits per channel (colour type 6 = RGBA, 2 = RGB). `idat` replaces the
 * image data (e.g. broken bytes); without it the pixels are valid (filter 0, all zero).
 */
export function makePng({width = 2, height = 2, colorType = 6, idat}: {width?: number; height?: number; colorType?: 2 | 6; idat?: Buffer} = {}): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const channels = colorType === 6 ? 4 : 3;
  const data = idat ?? deflateSync(Buffer.alloc(height * (1 + width * channels)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', data),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A small file that claims 20000×20000 RGBA pixels: its data inflates to far more than it is. */
export function makePngBomb(): Buffer {
  return makePng({width: 20000, height: 20000, idat: deflateSync(Buffer.alloc(4 * 1024 * 1024))});
}

/** An RGBA PNG with broken image data (PDFKit used to never finish the PDF on it). */
export function makeCorruptRgbaPng(): Buffer {
  return makePng({width: 4, height: 4, idat: Buffer.from('this is not zlib data at all')});
}

/** A minimal JPEG header with a SOF0 frame of `width`×`height` (enough for the size check). */
export function makeJpegHeader(width: number, height: number): Buffer {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]), sof, Buffer.from([0xff, 0xd9])]);
}
