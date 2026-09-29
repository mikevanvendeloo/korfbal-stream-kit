import request from 'supertest';
import {execSync} from 'node:child_process';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '../services/prisma';
import {ACTIVE_SEASON_ID_KEY} from '../services/season';
import {setSetting} from '../services/appSettings';

const runDb = process.env.REQUIRE_DB === 'true';

// Far-future seasons so this suite never collides with real or other test data.
const OLD_YEAR = 2091;
const NEW_YEAR = 2092;

describe.runIf(runDb)('Seasons (integration)', () => {
  let previousActive: unknown = null;

  async function cleanup() {
    const seasons = await prisma.season.findMany({where: {startYear: {gte: 2090}}, select: {id: true}});
    const ids = seasons.map((s) => s.id);
    await prisma.production.deleteMany({where: {matchSchedule: {seasonId: {in: ids}}}});
    await prisma.matchSchedule.deleteMany({where: {seasonId: {in: ids}}});
    await prisma.player.deleteMany({where: {seasonId: {in: ids}}});
    await prisma.club.deleteMany({where: {slug: 'season-int-club'}});
    await prisma.season.deleteMany({where: {id: {in: ids}}});
  }

  beforeAll(async () => {
    execSync('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma', {stdio: 'inherit'});
    previousActive = (await prisma.setting.findUnique({where: {key: ACTIVE_SEASON_ID_KEY}}))?.value ?? null;
    await cleanup();
  });

  afterAll(async () => {
    await setSetting(ACTIVE_SEASON_ID_KEY, previousActive as any);
    await cleanup();
  });

  it('manages seasons and scopes matches, productions and players by season', async () => {
    const oldSeason = await request(app).post('/api/seasons').send({name: `${OLD_YEAR}/${OLD_YEAR + 1}`});
    expect(oldSeason.status).toBe(201);
    const newSeason = await request(app).post('/api/seasons').send({name: `${NEW_YEAR}/${NEW_YEAR + 1}`, activate: true});
    expect(newSeason.status).toBe(201);
    expect(newSeason.body.isActive).toBe(true);
    expect((await request(app).post('/api/seasons').send({name: `${NEW_YEAR}/${NEW_YEAR + 1}`})).status).toBe(409);

    // Manual matches get their season from the date; 30 June 23:30 Amsterdam is still the old season.
    const oldMatch = await request(app).post('/api/manual-matches').send({
      date: `${OLD_YEAR + 1}-06-30T21:30:00.000Z`, homeTeamName: 'Old Home', awayTeamName: 'Old Away',
    });
    const newMatch = await request(app).post('/api/manual-matches').send({
      date: `${NEW_YEAR}-10-01T18:00:00.000Z`, homeTeamName: 'New Home', awayTeamName: 'New Away',
    });
    expect(oldMatch.body.seasonId).toBe(oldSeason.body.id);
    expect(newMatch.body.seasonId).toBe(newSeason.body.id);

    await request(app).post('/api/production').send({matchScheduleId: oldMatch.body.id});
    await request(app).post('/api/production').send({matchScheduleId: newMatch.body.id});

    const activeProductions = await request(app).get('/api/production');
    expect(activeProductions.body.items.map((p: any) => p.matchScheduleId)).toEqual([newMatch.body.id]);
    const oldProductions = await request(app).get(`/api/production?seasonId=${oldSeason.body.id}`);
    expect(oldProductions.body.items.map((p: any) => p.matchScheduleId)).toEqual([oldMatch.body.id]);

    const manual = await request(app).get('/api/manual-matches');
    expect(manual.body.map((m: any) => m.id)).toEqual([newMatch.body.id]);

    // Players: same externalId may exist once per season.
    const club = await request(app).post('/api/clubs/import').send({
      name: 'Season Int Club', slug: 'season-int-club', shortName: 'season-int-club',
      players: [{name: 'Speler Een', externalId: 'ext-1'}],
    });
    expect(club.body).toMatchObject({seasonId: newSeason.body.id, playersCreated: 1});
    const again = await request(app).post('/api/clubs/import').send({
      seasonId: oldSeason.body.id, name: 'Season Int Club', shortName: 'season-int-club',
      players: [{name: 'Speler Een', externalId: 'ext-1'}],
    });
    expect(again.body).toMatchObject({seasonId: oldSeason.body.id, playersCreated: 1, clubsUpdated: 1});
    const players = await prisma.player.findMany({where: {externalId: 'ext-1'}});
    expect(players.map((p) => p.seasonId).sort()).toEqual([oldSeason.body.id, newSeason.body.id].sort());

    const list = await request(app).get('/api/seasons');
    const byId = Object.fromEntries(list.body.map((s: any) => [s.id, s]));
    expect(byId[newSeason.body.id]).toMatchObject({isActive: true, matchCount: 1, playerCount: 1});
    expect(byId[oldSeason.body.id]).toMatchObject({isActive: false, matchCount: 1, playerCount: 1});

    // Deletion guards
    expect((await request(app).delete(`/api/seasons/${newSeason.body.id}`)).status).toBe(409);
    expect((await request(app).delete(`/api/seasons/${oldSeason.body.id}`)).status).toBe(409);
    const empty = await request(app).post('/api/seasons').send({name: '2095/2096'});
    expect((await request(app).delete(`/api/seasons/${empty.body.id}`)).status).toBe(204);

    const switched = await request(app).put('/api/seasons/active').send({seasonId: oldSeason.body.id});
    expect(switched.body).toMatchObject({id: oldSeason.body.id, isActive: true});
    expect((await request(app).get('/api/seasons/active')).body.id).toBe(oldSeason.body.id);
  });
});
