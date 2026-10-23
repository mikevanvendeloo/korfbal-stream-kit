import {inflateSync} from 'node:zlib';

/**
 * Checks on an image's own bytes before anything decodes it (an upload, or PDFKit in a report).
 * A small file can claim a huge size (a decompression bomb: 155 KB that says 20000×20000 pixels made
 * PDFKit use 3.4 GB), and PDFKit decodes a PNG with alpha, transparency or interlace asynchronously,
 * outside any try/catch: broken data then never finishes the PDF. So: read the size from the header
 * (PNG IHDR, JPEG SOF, GIF, WebP) and refuse it above the limit, and decompress a PNG's data once,
 * synchronously and bounded, before PDFKit sees it.
 */
export const MAX_IMAGE_SIDE = 8192;
export const MAX_IMAGE_PIXELS = 4096 * 4096;

export type ImageDimensions = {width: number; height: number};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(b: Buffer): boolean {
  return b.length >= 8 && b.subarray(0, 8).equals(PNG_SIGNATURE);
}

function pngDimensions(b: Buffer): ImageDimensions | null {
  // Signature, then the IHDR chunk: length (4), "IHDR", width (4), height (4)
  if (b.length < 24 || b.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return {width: b.readUInt32BE(16), height: b.readUInt32BE(20)};
}

/** SOFn markers that carry the frame size (not DHT C4, JPG C8, DAC CC). */
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegDimensions(b: Buffer): ImageDimensions | null {
  let offset = 2; // after SOI
  while (offset + 4 <= b.length) {
    if (b[offset] !== 0xff) return null;
    const marker = b[offset + 1];
    if (marker === 0xff) { offset++; continue; } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; } // no length
    if (marker === 0xd9 || marker === 0xda) return null; // end of image, or scan data before any frame header
    const length = b.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (JPEG_SOF.has(marker)) {
      if (offset + 9 > b.length) return null;
      return {height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7)};
    }
    offset += 2 + length;
  }
  return null;
}

function gifDimensions(b: Buffer): ImageDimensions | null {
  return b.length >= 10 ? {width: b.readUInt16LE(6), height: b.readUInt16LE(8)} : null;
}

function webpDimensions(b: Buffer): ImageDimensions | null {
  if (b.length < 30) return null;
  const chunk = b.subarray(12, 16).toString('latin1');
  if (chunk === 'VP8 ') return {width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff};
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return {width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1};
  }
  if (chunk === 'VP8X') return {width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1};
  return null;
}

/** Width and height from the header, or null when the header can't be read. */
export function imageDimensions(b: Buffer): ImageDimensions | null {
  if (isPng(b)) return pngDimensions(b);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpegDimensions(b);
  if (['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1'))) return gifDimensions(b);
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return webpDimensions(b);
  return null;
}

export function isWithinPixelLimit({width, height}: ImageDimensions): boolean {
  return width > 0 && height > 0 && width <= MAX_IMAGE_SIDE && height <= MAX_IMAGE_SIDE && width * height <= MAX_IMAGE_PIXELS;
}

/** Channels per colour type, with the bit depths the PNG spec allows for it. */
const PNG_COLOR_TYPES: Record<number, {channels: number; depths: number[]}> = {
  0: {channels: 1, depths: [1, 2, 4, 8, 16]},
  2: {channels: 3, depths: [8, 16]},
  3: {channels: 1, depths: [1, 2, 4, 8]},
  4: {channels: 2, depths: [8, 16]},
  6: {channels: 4, depths: [8, 16]},
};

/** [x start, y start, x step, y step] of the seven Adam7 passes. */
const ADAM7: Array<[number, number, number, number]> = [
  [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
];

/**
 * Whether a PNG's image data is sound: a valid IHDR, IDAT that inflates (bounded to the size the header
 * promises) to exactly that size, and a valid filter type on every scanline. Call it only after the
 * pixel limit, which bounds the memory this uses.
 */
export function isSoundPng(b: Buffer): boolean {
  const size = pngDimensions(b);
  if (!size || !isWithinPixelLimit(size)) return false;
  const bitDepth = b[24];
  const colorType = b[25];
  const interlace = b[28];
  const type = PNG_COLOR_TYPES[colorType];
  if (!type || !type.depths.includes(bitDepth) || b[26] !== 0 || b[27] !== 0 || interlace > 1) return false;

  const bitsPerPixel = type.channels * bitDepth;
  const passes = interlace === 1 ? ADAM7 : [[0, 0, 1, 1] as [number, number, number, number]];
  const scanlines: number[] = []; // bytes per scanline (without the filter byte), one entry per pass with rows
  const rowsPerPass: number[] = [];
  let expected = 0;
  for (const [xs, ys, dx, dy] of passes) {
    const w = Math.max(0, Math.ceil((size.width - xs) / dx));
    const h = Math.max(0, Math.ceil((size.height - ys) / dy));
    if (!w || !h) continue;
    const rowBytes = Math.ceil((w * bitsPerPixel) / 8);
    scanlines.push(rowBytes);
    rowsPerPass.push(h);
    expected += h * (1 + rowBytes);
  }

  // Collect the IDAT chunks (length, type, data, crc)
  const parts: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= b.length) {
    const length = b.readUInt32BE(offset);
    const chunkType = b.subarray(offset + 4, offset + 8).toString('latin1');
    const end = offset + 12 + length;
    if (end > b.length) return false;
    if (chunkType === 'IDAT') parts.push(b.subarray(offset + 8, offset + 8 + length));
    if (chunkType === 'IEND') break;
    offset = end;
  }
  if (!parts.length) return false;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(parts), {maxOutputLength: expected});
  } catch {
    return false; // broken data, or more data than the header promises
  }
  if (raw.length !== expected) return false;
  let position = 0;
  for (let pass = 0; pass < scanlines.length; pass++) {
    for (let row = 0; row < rowsPerPass[pass]; row++) {
      if (raw[position] > 4) return false;
      position += 1 + scanlines[pass];
    }
  }
  return true;
}

/**
 * Why an image must not be decoded, or null when it may: unreadable size, above the pixel limit, or
 * (PNG) broken data. Text for the user, in Dutch.
 */
export function unsafeImageReason(b: Buffer): string | null {
  const size = imageDimensions(b);
  if (!size) return 'onleesbare afbeelding';
  if (!isWithinPixelLimit(size)) return `te groot (${size.width}×${size.height} pixels, max. 4096×4096)`;
  if (isPng(b) && !isSoundPng(b)) return 'beschadigde afbeelding';
  return null;
}
