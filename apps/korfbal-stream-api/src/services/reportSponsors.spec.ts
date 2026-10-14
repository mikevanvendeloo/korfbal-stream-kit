import fs from 'node:fs';
import path from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {getAssetsRoot} from './config';
import {findSponsorByName, sponsorLogoFile, sponsorLogoPath} from './reportSponsors';

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

  it('only hands PDFKit existing PNG/JPEG files inside the assets dir', () => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, 'x');
    expect(sponsorLogoFile('sponsors/report-sponsor-spec.png')).toBe(file);
    expect(sponsorLogoFile('sponsors/bestaat-niet.png')).toBeNull();
    expect(sponsorLogoFile('sponsors/logo.svg')).toBeNull();
    expect(sponsorLogoFile('sponsors/../../../etc/passwd.png')).toBeNull();
    expect(sponsorLogoFile(null)).toBeNull();
  });
});
