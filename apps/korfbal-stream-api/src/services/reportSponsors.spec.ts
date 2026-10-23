import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterAll, describe, expect, it} from 'vitest';
import {getAssetsRoot} from './config';
import {findSponsorByName, imageFormatOf, pdfImage, pdfImageData} from './reportSponsors';
import {makeCorruptRgbaPng, makePng, makePngBomb} from '../../test-images';

const PNG = makePng();
const WEBP_HEAD = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

const sponsors = [
  {name: 'Bakkerij Jansen', displayName: null, logoUrl: 'bakkerij-jansen.png'},
  {name: 'AKB Financial Services B.V.', displayName: 'AKB', logoUrl: 'akb.jpg'},
  {name: 'Zonder logo', displayName: null, logoUrl: ''},
];

describe('report sponsors', () => {
  const dir = path.join(getAssetsRoot(), 'sponsors', 'report-spec');
  const file = path.join(dir, 'logo.png');
  const rel = 'sponsors/report-spec/logo.png';
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'report-spec-outside-'));

  afterAll(() => {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(outside, {recursive: true, force: true});
  });

  const write = (name: string, data: Buffer | string) => {
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, name), data);
  };

  it('finds the sponsor by name or display name, ignoring case and spaces', () => {
    expect(findSponsorByName('  bakkerij   JANSEN ', sponsors)?.logoUrl).toBe('bakkerij-jansen.png');
    expect(findSponsorByName('akb', sponsors)?.name).toBe('AKB Financial Services B.V.');
    expect(findSponsorByName('Vrije tekst sponsor', sponsors)).toBeUndefined();
    expect(findSponsorByName('', sponsors)).toBeUndefined();
  });

  it('hands PDFKit the bytes of an existing PNG/JPEG (by content) inside the assets dir, read once', () => {
    write('logo.png', PNG);
    expect(pdfImageData(rel)?.equals(PNG)).toBe(true);
    expect(pdfImageData(`/${rel}`)?.equals(PNG)).toBe(true);
    expect(pdfImageData('sponsors/bestaat-niet.png')).toBeNull();
    expect(pdfImageData('sponsors/logo.svg')).toBeNull();
    expect(pdfImageData('sponsors/../../../etc/passwd.png')).toBeNull();
    expect(pdfImageData(null)).toBeNull();
  });

  it('judges a file by its content, not its name', () => {
    write('logo.png', WEBP_HEAD);
    expect(pdfImageData(rel)).toBeNull();
    expect(pdfImage(rel)).toEqual({status: 'unsupported', format: 'webp'});
    write('logo.png', 'x');
    expect(pdfImage(rel)).toEqual({status: 'unsupported', format: 'onbekend formaat'});
    expect(pdfImage('sponsors/bestaat-niet.png')).toEqual({status: 'missing'});
    expect(pdfImage('sponsors/../../../etc/passwd')).toEqual({status: 'missing'});
    expect(pdfImage('')).toBeNull();
  });

  it('refuses a decompression bomb (20000×20000) and a corrupt RGBA PNG before PDFKit sees them', () => {
    write('bomb.png', makePngBomb());
    expect(pdfImage('sponsors/report-spec/bomb.png')).toMatchObject({status: 'unsupported', format: expect.stringContaining('te groot')});
    write('corrupt.png', makeCorruptRgbaPng());
    expect(pdfImage('sponsors/report-spec/corrupt.png')).toEqual({status: 'unsupported', format: 'beschadigde afbeelding'});
  });

  it('does not follow a symlink, to a file outside the assets dir or inside it', () => {
    const secret = path.join(outside, 'secret.png');
    fs.writeFileSync(secret, PNG);
    write('logo.png', PNG);
    fs.symlinkSync(secret, path.join(dir, 'link-out.png'));
    fs.symlinkSync(file, path.join(dir, 'link-in.png'));
    expect(pdfImage('sponsors/report-spec/link-out.png')).toEqual({status: 'missing'});
    expect(pdfImage('sponsors/report-spec/link-in.png')).toEqual({status: 'missing'});
    // A linked directory neither
    fs.symlinkSync(outside, path.join(dir, 'linked-dir'));
    expect(pdfImage('sponsors/report-spec/linked-dir/secret.png')).toEqual({status: 'missing'});
  });

  it.runIf(process.platform !== 'win32')('does not block on a FIFO and reads only regular files', () => {
    fs.mkdirSync(dir, {recursive: true});
    execFileSync('mkfifo', [path.join(dir, 'fifo.png')]);
    expect(pdfImage('sponsors/report-spec/fifo.png')).toEqual({status: 'missing'});
    expect(pdfImage('sponsors/report-spec')).toEqual({status: 'missing'}); // a directory
  });

  it('recognises the upload formats by their first bytes', () => {
    expect(imageFormatOf(PNG)).toBe('png');
    expect(imageFormatOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(imageFormatOf(Buffer.from('GIF89a'))).toBe('gif');
    expect(imageFormatOf(WEBP_HEAD)).toBe('webp');
    expect(imageFormatOf(Buffer.from('<svg'))).toBeNull();
    expect(imageFormatOf(Buffer.alloc(0))).toBeNull();
  });
});
