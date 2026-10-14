import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '../services/prisma';
import {currentSeasonId} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('vMix match info data source (integration)', () => {
  let productionId: number;
  let matchId: number;
  let clubId: number;
  let sponsorId: number;
  const slug = `vmix-match-int-${Date.now()}`;

  beforeAll(async () => {
    // Other productions must not be active, or they'd be picked instead of ours
    await prisma.production.updateMany({where: {isActive: true}, data: {isActive: false}});
    clubId = (await prisma.club.create({data: {name: 'Vmixmatch Thuisclub', shortName: 'Vmixmatch', slug, logoUrl: 'clubs/vmixmatch.png'}})).id;
    sponsorId = (await prisma.sponsor.create({data: {name: 'Vmixmatch Balsponsor', type: 'goud', logoUrl: 'vmixmatch.png', websiteUrl: 'https://example.org'}})).id;
    const match = await prisma.matchSchedule.create({
      data: {
        seasonId: await currentSeasonId(prisma), externalId: slug, date: new Date('2026-10-17T18:00:00.000Z'),
        homeTeamName: 'Vmixmatch 1', awayTeamName: 'Tegenstander 1', isHomeMatch: true,
        refereeName: 'J. de Vries', reserveRefereeName: 'P. Bakker', accommodationName: 'Sporthal',
      },
    });
    matchId = match.id;
    productionId = (await prisma.production.create({
      data: {matchScheduleId: match.id, isActive: true, productionReport: {create: {ballSponsor: 'Vmixmatch Balsponsor'}}},
    })).id;
  });

  afterAll(async () => {
    await prisma.production.deleteMany({where: {id: productionId}});
    await prisma.matchSchedule.deleteMany({where: {id: matchId}});
    await prisma.club.deleteMany({where: {id: clubId}});
    await prisma.sponsor.deleteMany({where: {id: sponsorId}});
  });

  it('returns the match of the active production as one row', async () => {
    const res = await request(app).get('/api/vmix/active-production/match').set('Host', '10.0.0.5:3333');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      productionId: String(productionId),
      match: 'Vmixmatch 1 - Tegenstander 1',
      homeShort: 'Vmixmatch',
      homeLogo: 'http://10.0.0.5:3333/uploads/clubs/vmixmatch.png',
      kickoff: '20:00',
      accommodation: 'Sporthal',
      referees: 'J. de Vries & P. Bakker',
      ballSponsor: 'Vmixmatch Balsponsor',
      ballSponsorLogo: 'http://10.0.0.5:3333/uploads/sponsors/vmixmatch.png',
      matchSponsor: '',
    });
  });

  it('is listed among the vMix data sources', async () => {
    const res = await request(app).get('/api/vmix/endpoints');
    expect(res.body.endpoints.map((e: { url: string }) => e.url)).toContainEqual(expect.stringMatching(/\/api\/vmix\/active-production\/match$/));
  });

  it('clears all fields when no production is active', async () => {
    await prisma.production.update({where: {id: productionId}, data: {isActive: false}});
    const res = await request(app).get('/api/vmix/active-production/match');
    expect(Object.values(res.body[0]).every((v) => v === '')).toBe(true);
  });
});
