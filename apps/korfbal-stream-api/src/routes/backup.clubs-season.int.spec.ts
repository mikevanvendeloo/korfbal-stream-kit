import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

/**
 * POST /api/backup/clubs/import: players keep their exported season. A backup from before the seasons
 * (players without seasonName) needs the season chosen (?seasonId=); it never lands silently in the
 * active season.
 */
describe.runIf(runDb)('clubs restore and the season of the players (integration)', () => {
  const SLUG = `cs-club-${Date.now()}`;
  const CHOSEN = {startYear: 2093, name: '2093/2094'};
  const EXPORTED = {startYear: 2095, name: '2095/2096'};
  let chosenId: number;

  const backup = (players: object[]) => [{name: 'CS Club', shortName: 'CS', slug: SLUG, players}];
  const restore = (body: object, query = '') => request(app).post(`/api/backup/clubs/import${query}`).send(body);
  const playersOf = async () => (await prisma.player.findMany({
    where: {club: {slug: SLUG}}, select: {name: true, season: {select: {name: true}}}, orderBy: {name: 'asc'},
  })).map((p) => `${p.name}: ${p.season.name}`);

  beforeAll(async () => {
    chosenId = (await prisma.season.upsert({where: {startYear: CHOSEN.startYear}, update: {}, create: CHOSEN})).id;
  });

  afterAll(async () => {
    await prisma.club.deleteMany({where: {slug: SLUG}});
    await prisma.season.deleteMany({where: {startYear: {in: [CHOSEN.startYear, EXPORTED.startYear]}}});
  });

  it('refuses a backup with players without a season when none is chosen, and writes nothing', async () => {
    const res = await restore(backup([{name: 'Zonder 1'}, {name: 'Zonder 2', seasonName: 'geen seizoen'}, {name: 'Met', seasonName: EXPORTED.name}]));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({code: 'PLAYER_SEASON_REQUIRED', playersWithoutSeason: 2});
    expect(await prisma.club.count({where: {slug: SLUG}})).toBe(0);
  });

  it('refuses an unknown season', async () => {
    const res = await restore(backup([{name: 'Zonder 1'}]), '?seasonId=999999999');
    expect(res.status).toBe(400);
    expect(await prisma.club.count({where: {slug: SLUG}})).toBe(0);
  });

  it('puts players without a season in the chosen season, the others in their own', async () => {
    const res = await restore(backup([{name: 'Zonder 1'}, {name: 'Met', seasonName: EXPORTED.name}]), `?seasonId=${chosenId}`);
    expect(res.status).toBe(200);
    expect(await playersOf()).toEqual([`Met: ${EXPORTED.name}`, `Zonder 1: ${CHOSEN.name}`]);
  });

  it('needs no choice when every player has a season', async () => {
    const res = await restore(backup([{name: 'Met 2', seasonName: EXPORTED.name}]));
    expect(res.status).toBe(200);
    expect(await playersOf()).toContain(`Met 2: ${EXPORTED.name}`);
  });
});
