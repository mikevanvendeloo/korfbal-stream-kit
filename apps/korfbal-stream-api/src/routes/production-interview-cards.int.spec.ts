import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {ensureOrganization, testDb as prisma} from '../../test-helpers';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';

const runDb = process.env.REQUIRE_DB === 'true';

/** The interview choice with photo and shirt number, for the LIVE Interviews screen and the callsheet photos. */
describe.runIf(runDb)('interview cards and people (integration)', () => {
  const OTHER = 'cards-other-org';
  let show: ProductionScenario;
  let empty: ProductionScenario;
  let foreign: ProductionScenario;

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      match: {homeTeamName: 'Cards Thuis 1', awayTeamName: 'Cards Uit 2'},
      interviews: [
        {side: 'HOME', role: 'PLAYER', name: 'Anna de Vries', shirtNo: 7, photoUrl: 'players/anna.png'},
        {side: 'AWAY', role: 'COACH', name: 'Kees Coach'},
        {side: 'NONE', role: 'PLAYER', name: 'Gast Speler', shirtNo: 12},
      ],
    });
    empty = await createProductionScenario(prisma, {});
    foreign = await createProductionScenario(prisma, {
      organizationId: await ensureOrganization(prisma, OTHER, 'Cards Other'),
      interviews: [{side: 'HOME', role: 'PLAYER', name: 'Vreemde Speelster', shirtNo: 3}],
    });
  });

  afterAll(async () => {
    await show?.cleanup();
    await empty?.cleanup();
    await foreign?.cleanup();
    await prisma.organization.deleteMany({where: {slug: OTHER}});
  });

  it('gives one card per chosen interview with only the fields the screen shows', async () => {
    const res = await request(app).get(`/api/production/${show.productionId}/interview-cards`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {id: expect.any(Number), side: 'HOME', role: 'PLAYER', title: null, name: 'Anna de Vries', shirtNo: 7, photoUrl: 'players/anna.png', teamName: 'Cards Thuis 1'},
        {id: expect.any(Number), side: 'AWAY', role: 'COACH', title: null, name: 'Kees Coach', shirtNo: null, photoUrl: null, teamName: 'Cards Uit 2'},
        // Without a side the player's club names the team
        {id: expect.any(Number), side: 'NONE', role: 'PLAYER', title: null, name: 'Gast Speler', shirtNo: 12, photoUrl: null, teamName: 'Scenario'},
      ],
    });
  });

  it('gives an empty list without a choice', async () => {
    const res = await request(app).get(`/api/production/${empty.productionId}/interview-cards`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({items: []});
  });

  it('adds shirt number and photo to the interview names for the placeholders', async () => {
    const res = await request(app).get(`/api/production/${show.productionId}/interview-names`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ownSide: 'HOME',
      names: {HOME: {PLAYER: 'Anna de Vries', COACH: null}, AWAY: {PLAYER: null, COACH: 'Kees Coach'}},
      people: {
        HOME: {PLAYER: {name: 'Anna de Vries', shirtNo: 7, photoUrl: 'players/anna.png'}, COACH: null},
        AWAY: {PLAYER: null, COACH: {name: 'Kees Coach', shirtNo: null, photoUrl: null}},
      },
    });
  });

  it('answers 404 for another organization\'s production, without its people', async () => {
    for (const path of ['interview-cards', 'interview-names']) {
      const res = await request(app).get(`/api/production/${foreign.productionId}/${path}`);
      expect(res.status, path).toBe(404);
      expect(res.text).not.toContain('Vreemde');
    }
    // The owner does see them
    const own = await request(app).get(`/api/production/${foreign.productionId}/interview-cards`).set('X-Organization', OTHER);
    expect(own.status).toBe(200);
    expect(own.body.items.map((i: {name: string}) => i.name)).toEqual(['Vreemde Speelster']);
  });

  it('refuses an invalid id', async () => {
    expect((await request(app).get('/api/production/abc/interview-cards')).status).toBe(400);
  });
});
