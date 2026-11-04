import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {createProductionScenario, ensureOrganization, ProductionScenario} from '../../test-scenarios';
import {testDb as prisma, withoutOrganization} from '../../test-helpers';
import {runWithOrganization} from '../services/organizationContext';
import {amsterdamDay, amsterdamDayRange} from '../utils/time';

const runDb = process.env.REQUIRE_DB === 'true';
const DAY = 24 * 60 * 60 * 1000;

/**
 * POST /api/production/activate-next | activate-previous: a Stream Deck button (feed, API key) that
 * activates the production of the first match from today on, or the last one before today.
 */
describe.runIf(runDb)('activate next/previous production (integration)', () => {
  const SLUG = `act-rel-${Date.now()}`;
  let orgId: number;
  let key: string;
  const shows: Record<string, ProductionScenario> = {};

  const press = (direction: 'next' | 'previous', k = key) =>
    withoutOrganization(request(app).post(`/api/production/activate-${direction}?key=${k}`));
  const activeIds = () => runWithOrganization(orgId, async () =>
    (await prisma.production.findMany({where: {isActive: true}, select: {id: true}})).map((p) => p.id));

  beforeAll(async () => {
    orgId = await ensureOrganization(prisma, SLUG, 'Activate Relative');
    const startOfToday = amsterdamDayRange(amsterdamDay(new Date())).start;
    const at = (ms: number) => ({organizationId: orgId, match: {date: new Date(startOfToday.getTime() + ms)}});
    shows.lastWeek = await createProductionScenario(prisma, at(-7 * DAY));
    shows.yesterday = await createProductionScenario(prisma, at(-DAY + 60 * 60 * 1000));
    // One minute past midnight: today's match counts as next, even when it has started
    shows.today = await createProductionScenario(prisma, at(60 * 1000));
    shows.nextWeek = await createProductionScenario(prisma, at(7 * DAY));
    const res = await request(app).post('/api/organization/api-keys').set('X-Organization', SLUG).send({name: 'Stream Deck'});
    expect(res.status).toBe(201);
    key = res.body.key;
  });

  afterAll(async () => {
    for (const show of Object.values(shows)) await show.cleanup();
    await prisma.organization.deleteMany({where: {id: orgId}});
  });

  it('next activates the production of today (the first match from today on)', async () => {
    const res = await press('next');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({id: shows.today.productionId, isActive: true, matchSchedule: {id: shows.today.matchId}});
    expect(await activeIds()).toEqual([shows.today.productionId]);
  });

  it('previous activates the last production before today, deactivating the others', async () => {
    const res = await press('previous');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(shows.yesterday.productionId);
    expect(await activeIds()).toEqual([shows.yesterday.productionId]);
  });

  it('answers 404 when there is no production in that direction', async () => {
    await runWithOrganization(orgId, () => prisma.production.deleteMany({
      where: {id: {in: [shows.today.productionId, shows.nextWeek.productionId]}},
    }));
    const res = await press('next');
    expect(res.status).toBe(404);
    expect(await activeIds()).toEqual([shows.yesterday.productionId]);
  });

  it('only looks at the organization of the key (security)', async () => {
    // The test organization has productions from today on; this organization has none left
    await createProductionScenario(prisma, {match: {date: new Date(Date.now() + DAY)}}).then(async (other) => {
      try {
        expect((await press('next')).status).toBe(404);
        const theirs = await prisma.production.findUniqueOrThrow({where: {id: other.productionId}});
        expect(theirs.isActive).toBe(false);
      } finally {
        await other.cleanup();
      }
    });
  });

  it('needs a valid key without X-Organization, and refuses a cross-site post (security)', async () => {
    expect((await withoutOrganization(request(app).post('/api/production/activate-next'))).status).toBe(401);
    expect((await press('next', 'sk_invalid')).status).toBe(401);
    const crossSite = await request(app).post('/api/production/activate-previous').set('X-Organization', SLUG)
      .set('Origin', 'https://evil.example').set('Sec-Fetch-Site', 'cross-site');
    expect(crossSite.status).toBe(403);
  });
});
