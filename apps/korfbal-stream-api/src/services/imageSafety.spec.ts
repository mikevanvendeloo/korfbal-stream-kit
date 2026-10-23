import {deflateSync} from 'node:zlib';
import {describe, expect, it} from 'vitest';
import {imageDimensions, isSoundPng, unsafeImageReason} from './imageSafety';
import {makeCorruptRgbaPng, makeJpegHeader, makePng, makePngBomb} from '../../test-images';

describe('image safety', () => {
  it('reads the size from the header of every upload format', () => {
    expect(imageDimensions(makePng({width: 30, height: 20}))).toEqual({width: 30, height: 20});
    expect(imageDimensions(makeJpegHeader(640, 480))).toEqual({width: 640, height: 480});
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    expect(imageDimensions(gif)).toEqual({width: 1, height: 1});
    const webp = Buffer.alloc(30);
    webp.write('RIFF', 0, 'latin1');
    webp.write('WEBPVP8X', 8, 'latin1');
    webp.writeUIntLE(99, 24, 3);
    webp.writeUIntLE(49, 27, 3);
    expect(imageDimensions(webp)).toEqual({width: 100, height: 50});
    expect(imageDimensions(Buffer.from('<svg/>'))).toBeNull();
  });

  it('accepts a normal image', () => {
    expect(unsafeImageReason(makePng({width: 300, height: 120}))).toBeNull();
    expect(unsafeImageReason(makePng({width: 4096, height: 4096, colorType: 2}))).toBeNull();
    expect(unsafeImageReason(makeJpegHeader(4000, 3000))).toBeNull();
  });

  it('refuses images above 4096×4096 pixels by their header, whatever the file size', () => {
    expect(unsafeImageReason(makePngBomb())).toMatch(/te groot \(20000×20000/);
    expect(unsafeImageReason(makeJpegHeader(20000, 20000))).toMatch(/te groot/);
    expect(unsafeImageReason(makePng({width: 4097, height: 4096}))).toMatch(/te groot/);
    expect(unsafeImageReason(makePng({width: 9000, height: 10}))).toMatch(/te groot/);
  });

  it('refuses a PNG whose data is broken, too short, too long or has a bad filter type', () => {
    expect(unsafeImageReason(makeCorruptRgbaPng())).toBe('beschadigde afbeelding');
    expect(isSoundPng(makePng({width: 4, height: 4, idat: deflateSync(Buffer.alloc(10))}))).toBe(false);
    expect(isSoundPng(makePng({width: 4, height: 4, idat: deflateSync(Buffer.alloc(4 * 17 + 100))}))).toBe(false);
    const badFilter = Buffer.alloc(4 * 17);
    badFilter[0] = 9;
    expect(isSoundPng(makePng({width: 4, height: 4, idat: deflateSync(badFilter)}))).toBe(false);
    expect(isSoundPng(makePng({width: 4, height: 4}))).toBe(true);
  });

  it('refuses an image whose size it can not read', () => {
    expect(unsafeImageReason(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBe('onleesbare afbeelding');
  });
});
