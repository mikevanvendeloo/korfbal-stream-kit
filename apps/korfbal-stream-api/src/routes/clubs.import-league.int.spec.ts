import request from 'supertest';
import app from '../main';
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {prisma} from '../services/prisma';
import {currentSeasonId} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';
const SLUG = 'importint';

/**
 * league.korfbal.nl as it looks at the start of a season: the team pages have a team id but no pool yet.
 * Only the outside world is faked; the import writes to the test database.
 */
function fakeLeague(templateBodies: unknown[]) {
  return vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://league.korfbal.nl/teams/') {
      return new Response('<a href="/team/importint-a/">Importint</a>', {status: 200});
    }
    if (url.includes('/team/importint-a/')) {
      const ctx = {'preferred-group': null, tenant: 'league', pool_ids: [], team_id: '9910', language: 'nl'};
      return new Response(`<div class="page-wrapper" data-layout_context="${JSON.stringify(ctx).replace(/"/g, '&quot;')}">Team</div>`, {status: 200});
    }
    if (url.includes('get-template-data')) {
      templateBodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({found: true, statusCode: 200, data: {cards: [
        {status: 'active', ref_id: 'IMPINT1', full_name: 'Importint Speelster', gender: 'F', shirt_number: '7',
          team: {club_name: 'Importint', team_name_short: 'Importint', logo: {url: 'https://cdn.example.org/logo.png'}}},
        {status: 'active', ref_id: 'IMPINT2', full_name: 'Importint Coach', gender: 'M', function: 'Hoofdcoach'},
        {status: 'inactive', ref_id: 'IMPINT3', full_name: 'Importint Oud'},
      ]}}), {status: 200, headers: {'content-type': 'application/json'}});
    }
    // Logo and photo downloads
    return new Response(new Uint8Array([137, 80, 78, 71]), {status: 200, headers: {'content-type': 'image/png'}});
  });
}

describe.runIf(runDb)('Import league teams without a pool (integration)', () => {
  let seasonId: number;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    seasonId = await currentSeasonId(prisma);
  });

  afterEach(() => vi.stubGlobal('fetch', realFetch));

  afterAll(async () => {
    vi.unstubAllGlobals();
    const club = await prisma.club.findUnique({where: {slug: SLUG}});
    if (club) await prisma.club.delete({where: {id: club.id}});
  });

  it('imports the club and its active players with only a team id', async () => {
    const templateBodies: Array<{ context: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', fakeLeague(templateBodies));

    const res = await request(app).post('/api/clubs/import/league-teams').send({seasonId});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ok: true, clubsCreated: 1, playersCreated: 2});
    // The roster was asked for the team without a pool
    expect(templateBodies[0].context).toMatchObject({team_id: '9910', pool_ids: []});

    const club = await prisma.club.findUniqueOrThrow({where: {slug: SLUG}, include: {players: {orderBy: {name: 'asc'}}}});
    expect(club.players.map((p) => [p.name, p.seasonId, p.shirtNo])).toEqual([
      ['Importint Coach', seasonId, null],
      ['Importint Speelster', seasonId, 7],
    ]);
    expect(club.players.find((p) => p.name === 'Importint Coach')?.personType).toBe('coach');
  });

  it('updates instead of duplicating when the import runs again', async () => {
    vi.stubGlobal('fetch', fakeLeague([]));
    const res = await request(app).post('/api/clubs/import/league-teams').send({seasonId});
    expect(res.body).toMatchObject({clubsCreated: 0, clubsUpdated: 1, playersCreated: 0, playersUpdated: 2});
    expect(await prisma.player.count({where: {club: {slug: SLUG}}})).toBe(2);
  });
});
