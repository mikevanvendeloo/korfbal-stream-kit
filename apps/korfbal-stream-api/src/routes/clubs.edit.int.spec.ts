import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {currentSeasonId, testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';
// The lookup slug comes from the full raw short name
const SLUG = 'clubedit-sponsor';
const PAYLOAD = {name: 'Clubedit/Sponsor', shortName: 'Clubedit/Sponsor', players: [{name: 'Clubedit Speler'}]};

describe.runIf(runDb)('Club short name and editing a club (integration)', () => {
  let seasonId: number;

  beforeAll(async () => {
    seasonId = await currentSeasonId(prisma);
  });

  afterAll(async () => {
    for (const club of await prisma.club.findMany({where: {OR: [{slug: SLUG}, {slug: {startsWith: 'tolerant'}}]}})) {
      await prisma.player.deleteMany({where: {clubId: club.id}});
      await prisma.club.delete({where: {id: club.id}});
    }
  });

  it('import finds an existing club by its short name when the sponsor after the slash changed', async () => {
    const existing = await prisma.club.create({data: {name: 'Tolerant/Oude Sponsor', shortName: 'Tolérant', slug: 'tolerant-oude-sponsor', logoUrl: 'clubs/eigen.png'}});
    const res = await request(app).post('/api/clubs/import')
      .send({name: 'TOLERANT/Nieuwe Sponsor', shortName: 'TOLERANT/Nieuwe Sponsor', players: [{name: 'Tolerant Speler'}], seasonId});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({clubsCreated: 0, clubsUpdated: 1, playersCreated: 1});
    expect(await prisma.club.count({where: {slug: {startsWith: 'tolerant'}}})).toBe(1);
    expect(await prisma.player.findFirst({where: {name: 'Tolerant Speler'}})).toMatchObject({clubId: existing.id});
    // Its own name, short name and logo stay (the source had no logo)
    expect(await prisma.club.findUniqueOrThrow({where: {id: existing.id}})).toMatchObject({name: 'Tolerant/Oude Sponsor', shortName: 'Tolérant', logoUrl: 'clubs/eigen.png'});
  });

  it('import sets the part before the slash as short name and keeps the slug from the full name', async () => {
    const res = await request(app).post('/api/clubs/import').send({...PAYLOAD, seasonId});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({clubsCreated: 1, playersCreated: 1});
    const club = await prisma.club.findUniqueOrThrow({where: {slug: SLUG}});
    expect(club).toMatchObject({name: 'Clubedit/Sponsor', shortName: 'Clubedit', abbreviation: 'CLU'});
  });

  it('PUT edits name and short name, never the slug', async () => {
    const res = await request(app).put(`/api/clubs/${SLUG}`).send({name: ' Clubedit Hand ', shortName: 'CE', abbreviation: 'ce1'});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({slug: SLUG, name: 'Clubedit Hand', shortName: 'CE', abbreviation: 'CE1'});
  });

  it('re-import finds the same club and does not overwrite the edited names', async () => {
    const res = await request(app).post('/api/clubs/import').send({...PAYLOAD, seasonId});
    expect(res.body).toMatchObject({clubsCreated: 0, clubsUpdated: 1, playersUpdated: 1});
    expect(await prisma.club.count({where: {slug: {startsWith: 'clubedit'}}})).toBe(1);
    expect(await prisma.club.findUniqueOrThrow({where: {slug: SLUG}})).toMatchObject({name: 'Clubedit Hand', shortName: 'CE', abbreviation: 'CE1'});
  });

  it('PUT sets and removes the two club colours as HTML colour codes', async () => {
    const res = await request(app).put(`/api/clubs/${SLUG}`).send({primaryColor: ' #E30613 ', secondaryColor: '#ffffff'});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({primaryColor: '#e30613', secondaryColor: '#ffffff', shortName: 'CE'});
    const cleared = await request(app).put(`/api/clubs/${SLUG}`).send({secondaryColor: ''});
    expect(cleared.body).toMatchObject({primaryColor: '#e30613', secondaryColor: null});
  });

  it('PUT refuses an invalid body (400) and an unknown slug (404)', async () => {
    for (const body of [{shortName: '  '}, {name: 'x'.repeat(101)}, {slug: 'nieuw'}, {name: 5}, {abbreviation: ''}, {abbreviation: 'ABCDEF'}, {abbreviation: 'A-B'}, {primaryColor: 'red'}, {primaryColor: '#fff'}, {secondaryColor: '#12345g'}, {primaryColor: 5}]) {
      expect((await request(app).put(`/api/clubs/${SLUG}`).send(body)).status).toBe(400);
    }
    expect((await request(app).put('/api/clubs/bestaat-niet-club').send({name: 'X'})).status).toBe(404);
    expect((await prisma.club.findUniqueOrThrow({where: {slug: SLUG}})).shortName).toBe('CE');
  });

  it('PUT from another website is refused (CSRF)', async () => {
    const res = await request(app).put(`/api/clubs/${SLUG}`).set('Origin', 'https://evil.example').send({name: 'Gehackt'});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_SITE_REFUSED');
    expect((await prisma.club.findUniqueOrThrow({where: {slug: SLUG}})).name).toBe('Clubedit Hand');
  });
});
