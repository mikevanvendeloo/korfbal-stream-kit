import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import {unzipSync} from 'fflate';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {getAssetsRoot} from '../services/config';
import {clearOrganizationLookupCache} from '../middleware/organizationContext';
import {ensureOrganization, inOrganization, testDb as prisma} from '../../test-helpers';
import {createProductionScenario} from '../../test-scenarios';
import {makePng} from '../../test-images';
import {getSetting, setSetting, SPONSOR_CAROUSEL_EXTRA_KEY} from '../services/appSettings';

const runDb = process.env.REQUIRE_DB === 'true';

/** Supertest parser that keeps a binary body (a zip) as a Buffer. */
function binary(res: NodeJS.ReadableStream, done: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

/** In the order the Backup page's restore needs: skills before people and positions. */
const ENTITIES = ['skills', 'positions', 'persons', 'matches', 'sponsors', 'settings', 'producties'];

/**
 * Round trip: everything exported from organization A, restored into a new organization B with another
 * slug. Every field comes back, and the sponsor logos resolve with B's slug once the image download is
 * unpacked into B's directory.
 */
describe.runIf(runDb)('backup round trip into an organization with another slug (integration)', () => {
  const A = 'rt-alpha';
  const B = 'rt-beta';
  const SEASON = {startYear: 2091, name: '2091/2092'};
  const liveTime = new Date('2026-11-14T18:25:00.000Z');
  const startsAt = new Date('2026-11-14T18:30:00.000Z');
  let a: number;
  let b: number;
  let clubId: number;
  let sponsorId: number;
  const exported: Record<string, unknown> = {};
  const asA = (req: request.Test) => req.set('X-Organization', A);
  const asB = (req: request.Test) => req.set('X-Organization', B);

  beforeAll(async () => {
    a = await ensureOrganization(prisma, A, 'RT Alpha');
    b = await ensureOrganization(prisma, B, 'RT Beta');
    clubId = (await prisma.club.create({data: {name: 'RT Club', shortName: 'RT', slug: 'rt-club', logoUrl: 'clubs/rt-club.png'}})).id;
    fs.mkdirSync(path.join(getAssetsRoot(), 'clubs'), {recursive: true});
    fs.writeFileSync(path.join(getAssetsRoot(), 'clubs', 'rt-club.png'), makePng());
    await prisma.season.upsert({where: {startYear: SEASON.startYear}, update: {indoorStartDate: new Date('2091-09-15')}, create: {...SEASON, indoorStartDate: new Date('2091-09-15')}});

    // Organization A: details, own club, logo
    expect((await request(app).put(`/api/organizations/${a}`).send({name: 'RT Alpha Korfbal', clubId})).status).toBe(200);
    expect((await request(app).post(`/api/organizations/${a}/logo`).attach('file', makePng(), {filename: 'l.png', contentType: 'image/png'})).status).toBe(200);
    // A sponsor that is switched off, with categories and an uploaded logo
    const sponsor = await asA(request(app).post('/api/sponsors')).send({name: 'RT Sponsor', type: 'goud', websiteUrl: 'https://rt.example', displayName: 'RT', enabled: false});
    sponsorId = sponsor.body.id;
    await inOrganization(A, () => prisma.sponsor.update({where: {id: sponsorId}, data: {categories: 'Hoofdsponsor'}}));
    expect((await asA(request(app).post(`/api/sponsors/${sponsorId}/logo`)).attach('file', makePng(), {filename: 'x.png', contentType: 'image/png'})).body.logoUrl).toBe('rt-sponsor.png');
    // Settings, among them the carousel extra
    await inOrganization(A, () => setSetting(SPONSOR_CAROUSEL_EXTRA_KEY, {name: 'RT Businessclub', logoUrl: 'rt-businessclub.png', type: 'premium', websiteUrl: 'https://bc.example'}));
    // A production with planned times, a callsheet, report sponsors, crew with skills, on a manual match
    await createProductionScenario(prisma, {
      organizationId: a, liveTime, startsAt, callSheet: true,
      items: [{title: 'RT Opening', durationSec: 300}, {title: 'RT Wedstrijd', durationSec: 3600}],
      match: {homeTeamName: 'RT Thuis', awayTeamName: 'RT Uit', isManual: true, date: new Date('2026-11-14T19:30:00.000Z')},
      report: {matchSponsor: 'RT Sponsor', ballSponsor: 'RT Balsponsor', remarks: 'RT opmerking'},
      crew: [{name: 'RT Persoon', skills: ['RT_CAMERA'], present: true}],
    });

    for (const entity of ENTITIES) {
      const res = await asA(request(app).get(`/api/backup/${entity}/export`));
      expect(res.status, entity).toBe(200);
      exported[entity] = res.body;
    }
    // The season's date is cleared, so the restore has to bring it back
    await prisma.season.update({where: {startYear: SEASON.startYear}, data: {indoorStartDate: null}});
    for (const entity of ENTITIES) {
      const res = await asB(request(app).post(`/api/backup/${entity}/import`)).send(exported[entity]);
      expect(res.status, entity).toBe(200);
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {id: {in: [a, b]}}});
    await prisma.club.deleteMany({where: {id: clubId}});
    await prisma.season.deleteMany({where: {startYear: SEASON.startYear}});
    for (const slug of [A, B]) {
      fs.rmSync(path.join(getAssetsRoot(), 'sponsors', slug), {recursive: true, force: true});
      fs.rmSync(path.join(getAssetsRoot(), 'organizations', `${slug}.png`), {force: true});
    }
    fs.rmSync(path.join(getAssetsRoot(), 'clubs', 'rt-club.png'), {force: true});
    clearOrganizationLookupCache();
  });

  it('restores the organization details into B, but never B\'s slug', async () => {
    const organization = await prisma.organization.findUnique({where: {id: b}});
    expect(organization).toMatchObject({slug: B, name: 'RT Alpha Korfbal', clubId, logoUrl: `${B}.png`, isActive: true});
  });

  it('sets the season\'s indoor start date when it had none, and never overwrites another date', async () => {
    expect((await prisma.season.findUnique({where: {startYear: SEASON.startYear}}))?.indoorStartDate?.toISOString().slice(0, 10)).toBe('2091-09-15');
    await prisma.season.update({where: {startYear: SEASON.startYear}, data: {indoorStartDate: new Date('2091-10-01')}});
    await asB(request(app).post('/api/backup/settings/import')).send(exported.settings);
    expect((await prisma.season.findUnique({where: {startYear: SEASON.startYear}}))?.indoorStartDate?.toISOString().slice(0, 10)).toBe('2091-10-01');
    // A season that doesn't exist here is not created
    const before = await prisma.season.count();
    await asB(request(app).post('/api/backup/settings/import')).send([{key: 'seasonIndoorStartDates', value: [{seasonName: '2097/2098', indoorStartDate: '2097-09-01'}]}]);
    expect(await prisma.season.count()).toBe(before);
  });

  it('restores the sponsor with enabled, categories and its logo file name', async () => {
    const sponsor = await inOrganization(B, () => prisma.sponsor.findFirst({where: {name: 'RT Sponsor'}}));
    expect(sponsor).toMatchObject({enabled: false, categories: 'Hoofdsponsor', displayName: 'RT', logoUrl: 'rt-sponsor.png', websiteUrl: 'https://rt.example'});
  });

  it('restores the settings (also sponsorCarouselExtra) and the own club', async () => {
    const extra = await inOrganization(B, () => getSetting(SPONSOR_CAROUSEL_EXTRA_KEY));
    expect(extra).toMatchObject({name: 'RT Businessclub', logoUrl: 'rt-businessclub.png'});
    expect((await asB(request(app).get('/api/settings/club-config'))).body.ownClubId).toBe(clubId);
  });

  it('restores people with their skills', async () => {
    const person = await inOrganization(B, () => prisma.person.findFirst({where: {name: 'RT Persoon'}, include: {skills: {include: {skill: true}}}}));
    expect(person?.skills.map((s) => s.skill.code)).toEqual(['RT_CAMERA']);
  });

  it('restores the production with its times, callsheet, report sponsors and presence, on a manual match', async () => {
    const production = await inOrganization(B, () => prisma.production.findFirst({
      where: {matchSchedule: {homeTeamName: 'RT Thuis'}},
      include: {
        matchSchedule: true, productionReport: true, productionPersons: {include: {person: true}},
        callSheets: {include: {items: {orderBy: {orderIndex: 'asc'}}}}, productionEvents: {orderBy: {order: 'asc'}},
      },
    }));
    expect(production).toBeTruthy();
    expect(production!.liveTime?.toISOString()).toBe(liveTime.toISOString());
    expect(production!.matchSchedule.isManual).toBe(true);
    expect(production!.productionReport).toMatchObject({matchSponsor: 'RT Sponsor', ballSponsor: 'RT Balsponsor', remarks: 'RT opmerking'});
    expect(production!.productionPersons.map((p) => p.person.name)).toEqual(['RT Persoon']);
    const times = (rows: Array<{timeStart?: Date | null; timeEnd?: Date | null; plannedStartTime?: Date | null; plannedEndTime?: Date | null}>) =>
      rows.map((r) => [(r.timeStart ?? r.plannedStartTime)?.toISOString(), (r.timeEnd ?? r.plannedEndTime)?.toISOString()]);
    const expected = [
      ['2026-11-14T18:30:00.000Z', '2026-11-14T18:35:00.000Z'],
      ['2026-11-14T18:35:00.000Z', '2026-11-14T19:35:00.000Z'],
    ];
    expect(times(production!.callSheets[0].items)).toEqual(expected);
    expect(times(production!.productionEvents)).toEqual(expected);
  });

  it('gives an image download that, unpacked into B\'s directory, makes B\'s logos resolve', async () => {
    const zip = await asA(request(app).get('/api/backup/images')).buffer(true).parse(binary);
    expect(zip.status).toBe(200);
    expect(zip.headers['content-type']).toBe('application/zip');
    expect(zip.headers['content-disposition']).toMatch(new RegExp(`^attachment; filename="afbeeldingen-${A}-\\d{4}-\\d{2}-\\d{2}\\.zip"$`));
    const entries = unzipSync(new Uint8Array(zip.body));
    expect(Object.keys(entries).sort()).toEqual(['clubs/rt-club.png', `organizations/${A}.png`, `sponsors/${A}/rt-sponsor.png`]);

    // Unpack into storage/, with A's slug directory renamed to B's
    for (const [name, data] of Object.entries(entries)) {
      const target = path.join(getAssetsRoot(), name.replace(`sponsors/${A}/`, `sponsors/${B}/`).replace(`organizations/${A}.`, `organizations/${B}.`));
      if (target.includes(`/${B}`)) {
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, data);
      }
    }
    const list = await asB(request(app).get('/api/sponsors'));
    const sponsor = list.body.items.find((s: {name: string}) => s.name === 'RT Sponsor');
    expect(sponsor.logoSrc).toBe(`/uploads/sponsors/${B}/rt-sponsor.png`);
    expect((await request(app).get(sponsor.logoSrc)).status).toBe(200);
    const organization = await request(app).get(`/api/organizations/${b}`);
    expect((await request(app).get(`/uploads/${organization.body.displayLogoUrl}`)).status).toBe(200);
  });
});
