import fs from 'node:fs';
import path from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {getAssetsRoot} from './config';
import {findSponsorByName, imageFormatOf, pdfImage, sponsorLogoFile, sponsorLogoPath} from './reportSponsors';

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_HEAD = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

const sponsors = [
  {name: 'Bakkerij Jansen', displayName: null, logoUrl: 'bakkerij-jansen.png'},
  {name: 'AKB Financial Services B.V.', displayName: 'AKB', logoUrl: 'akb.jpg'},
  {name: 'Zonder logo', displayName: null, logoUrl: ''},
];

describe('report sponsors', () => {
  const file = path.join(getAssetsRoot(), 'sponsors', 'report-sponsor-spec.png');

  afterAll(() => fs.rmSync(file, {force: true}));

  it('finds the sponsor by name or display name, ignoring case and spaces', () => {
    expect(findSponsorByName('  bakkerij   JANSEN ', sponsors)?.logoUrl).toBe('bakkerij-jansen.png');
    expect(findSponsorByName('akb', sponsors)?.name).toBe('AKB Financial Services B.V.');
    expect(findSponsorByName('Vrije tekst sponsor', sponsors)).toBeUndefined();
    expect(findSponsorByName('', sponsors)).toBeUndefined();
  });

  it('gives the logo path below the assets dir, or none without a logo', () => {
    expect(sponsorLogoPath(sponsors[0])).toBe('sponsors/bakkerij-jansen.png');
    expect(sponsorLogoPath(sponsors[2])).toBeNull();
    expect(sponsorLogoPath(undefined)).toBeNull();
  });

  it('only hands PDFKit existing PNG/JPEG files (by content) inside the assets dir', () => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, PNG_HEAD);
    expect(sponsorLogoFile('sponsors/report-sponsor-spec.png')).toBe(file);
    expect(sponsorLogoFile('/sponsors/report-sponsor-spec.png')).toBe(file);
    expect(sponsorLogoFile('sponsors/bestaat-niet.png')).toBeNull();
    expect(sponsorLogoFile('sponsors/logo.svg')).toBeNull();
    expect(sponsorLogoFile('sponsors/../../../etc/passwd.png')).toBeNull();
    expect(sponsorLogoFile(null)).toBeNull();
  });

  it('judges a file by its content, not its name', () => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, WEBP_HEAD);
    expect(sponsorLogoFile('sponsors/report-sponsor-spec.png')).toBeNull();
    expect(pdfImage('sponsors/report-sponsor-spec.png')).toEqual({status: 'unsupported', format: 'webp'});
    fs.writeFileSync(file, 'x');
    expect(pdfImage('sponsors/report-sponsor-spec.png')).toEqual({status: 'unsupported', format: 'onbekend formaat'});
    expect(pdfImage('sponsors/bestaat-niet.png')).toEqual({status: 'missing'});
    expect(pdfImage('sponsors/../../../etc/passwd')).toEqual({status: 'missing'});
    expect(pdfImage('')).toBeNull();
  });

  it('recognises the upload formats by their first bytes', () => {
    expect(imageFormatOf(PNG_HEAD)).toBe('png');
    expect(imageFormatOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(imageFormatOf(Buffer.from('GIF89a'))).toBe('gif');
    expect(imageFormatOf(WEBP_HEAD)).toBe('webp');
    expect(imageFormatOf(Buffer.from('<svg'))).toBeNull();
    expect(imageFormatOf(Buffer.alloc(0))).toBeNull();
  });
});
