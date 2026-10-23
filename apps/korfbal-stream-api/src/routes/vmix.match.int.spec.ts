import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('vMix match info data source (integration)', () => {
  let productionId: number;
  let show: ProductionScenario;
  let clubId: number;
  let sponsorId: number;
  const slug = `vmix-match-int-${Date.now()}`;

  beforeAll(async () => {
    clubId = (await prisma.club.create({data: {name: 'Vmixmatch Thuisclub', shortName: 'Vmixmatch', slug, logoUrl: 'clubs/vmixmatch.png'}})).id;
    sponsorId = (await prisma.sponsor.create({data: {name: 'Vmixmatch Balsponsor', type: 'goud', logoUrl: 'vmixmatch.png', websiteUrl: 'https://example.org'}})).id;
    // Active, so the data source picks it (the scenario switches the other productions off)
    show = await createProductionScenario(prisma, {
      active: true,
      items: [],
      match: {
        date: new Date('2026-10-17T18:00:00.000Z'), homeTeamName: 'Vmixmatch 1', awayTeamName: 'Tegenstander 1',
        refereeName: 'J. de Vries', reserveRefereeName: 'P. Bakker', accommodationName: 'Sporthal',
      },
      report: {ballSponsor: 'Vmixmatch Balsponsor'},
    });
    productionId = show.productionId;
  });

  afterAll(async () => {
    await show.cleanup();
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
      ballSponsorLogo: 'http://10.0.0.5:3333/uploads/sponsors/test-org/vmixmatch.png',
      matchSponsor: '',
    });
  });

  it('is listed among the vMix data sources, with the API key to fill in', async () => {
    const res = await request(app).get('/api/vmix/endpoints');
    expect(res.body.endpoints.map((e: { url: string }) => e.url)).toContainEqual(expect.stringMatching(/\/api\/vmix\/active-production\/match\?key=<jouw-sleutel>$/));
  });

  it('clears all fields when no production is active', async () => {
    await prisma.production.update({where: {id: productionId}, data: {isActive: false}});
    const res = await request(app).get('/api/vmix/active-production/match');
    expect(Object.values(res.body[0]).every((v) => v === '')).toBe(true);
  });
});
