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
        // Away club first, then home; per club the coach before the player
        {id: expect.any(Number), side: 'AWAY', role: 'COACH', title: null, name: 'Kees Coach', shirtNo: null, photoUrl: null, teamName: 'Cards Uit 2'},
        {id: expect.any(Number), side: 'HOME', role: 'PLAYER', title: null, name: 'Anna de Vries', shirtNo: 7, photoUrl: 'players/anna.png', teamName: 'Cards Thuis 1'},
        // Without a side the player's club names the team
        {id: expect.any(Number), side: 'NONE', role: 'PLAYER', title: null, name: 'Gast Speler', shirtNo: 12, photoUrl: null, teamName: 'Scenario'},
      ],
      // The default items have no interview placeholder
      moments: [],
    });
  });

  it('gives an empty list without a choice', async () => {
    const res = await request(app).get(`/api/production/${empty.productionId}/interview-cards`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({items: [], moments: []});
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

describe.runIf(runDb)('interview order (integration)', () => {
  let show: ProductionScenario;

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      match: {homeTeamName: 'Volgorde Thuis 1', awayTeamName: 'Volgorde Uit 2'},
      chapters: ['Voorbeschouwing', 'Rust', 'Nabeschouwing'],
      items: [
        {title: 'Livestream starten', chapter: 'Voorbeschouwing'},
        {title: 'Interview {coach-uit}'},
        {title: 'Interview {coach-thuis}'},
        {title: 'Analyse', chapter: 'Rust'},
        {title: 'Interview {coach-uit} en {speler-uit}', chapter: 'Nabeschouwing'},
        {title: 'Interview {coach-thuis} en {speler-thuis}'},
      ],
      interviews: [
        {side: 'AWAY', role: 'COACH', name: 'Kees Uit'},
        {side: 'HOME', role: 'PLAYER', name: 'Anna Thuis', shirtNo: 7},
      ],
    });
  });
  afterAll(async () => { await show?.cleanup(); });

  it('lists the interviews in draaiboek order with their hoofdstuk, the same person twice', async () => {
    const res = await request(app).get(`/api/production/${show.productionId}/interview-cards`);
    expect(res.status).toBe(200);
    expect(res.body.moments.map((m: {position: number; chapter: string; title: string}) => [m.position, m.chapter, m.title])).toEqual([
      [1, 'Voorbeschouwing', 'Interview Kees Uit'],
      [2, 'Voorbeschouwing', 'Interview coach thuis'],
      [3, 'Nabeschouwing', 'Interview Kees Uit en speler uit'],
      [4, 'Nabeschouwing', 'Interview coach thuis en Anna Thuis'],
    ]);
  });

  it('puts the order in the report, its Markdown and its WhatsApp text', async () => {
    const report = await request(app).get(`/api/production/${show.productionId}/report`);
    expect(report.status).toBe(200);
    expect(report.body.enriched.interviewMoments).toHaveLength(4);
    const markdown = await request(app).get(`/api/production/${show.productionId}/report/markdown`);
    expect(markdown.text).toContain('## Volgorde van de interviews');
    expect(markdown.text).toContain('3. Nabeschouwing');
    const whatsapp = await request(app).get(`/api/production/${show.productionId}/report/whatsapp`);
    expect(whatsapp.text).toContain('Volgorde van de interviews');
  });
});

describe.runIf(runDb)('interview people order (integration)', () => {
  let show: ProductionScenario;
  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      interviews: [
        {side: 'HOME', role: 'PLAYER', name: 'Thuis Speler'},
        {side: 'HOME', role: 'COACH', name: 'Thuis Coach'},
        {side: 'AWAY', role: 'PLAYER', name: 'Uit Speler'},
        {side: 'AWAY', role: 'COACH', name: 'Uit Coach'},
      ],
    });
  });
  afterAll(async () => { await show?.cleanup(); });

  it('always gives the away club first, then the home club, per club the coach before the player', async () => {
    const expected = ['Uit Coach', 'Uit Speler', 'Thuis Coach', 'Thuis Speler'];
    const cards = await request(app).get(`/api/production/${show.productionId}/interview-cards`);
    expect(cards.body.items.map((i: {name: string}) => i.name)).toEqual(expected);
    const chosen = await request(app).get(`/api/production/${show.productionId}/interviews`);
    expect(chosen.body.map((i: {player: {name: string}}) => i.player.name)).toEqual(expected);
    const markdown = await request(app).get(`/api/production/${show.productionId}/report/markdown`);
    const at = (name: string) => markdown.text.indexOf(name);
    expect(at('Uit Coach')).toBeLessThan(at('Uit Speler'));
    expect(at('Uit Speler')).toBeLessThan(at('Thuis Coach'));
    expect(at('Thuis Coach')).toBeLessThan(at('Thuis Speler'));
  });
});

describe.runIf(runDb)('interviews report order (integration)', () => {
  let show: ProductionScenario;
  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      interviews: [
        {side: 'HOME', role: 'PLAYER', name: 'Rapport Thuis Speler'},
        {side: 'HOME', role: 'COACH', name: 'Rapport Thuis Coach'},
        {side: 'AWAY', role: 'PLAYER', name: 'Rapport Uit Speler'},
        {side: 'AWAY', role: 'COACH', name: 'Rapport Uit Coach'},
      ],
    });
  });
  afterAll(async () => { await show?.cleanup(); });

  it('gives per club the coach before the player (Dagbezetting and Interviews report)', async () => {
    const res = await request(app).get('/api/reports/interviews');
    expect(res.status).toBe(200);
    const row = res.body.find((p: {id: number}) => p.id === show.productionId);
    expect(row.awayInterviews.map((i: {name: string}) => i.name)).toEqual(['Rapport Uit Coach', 'Rapport Uit Speler']);
    expect(row.homeInterviews.map((i: {name: string}) => i.name)).toEqual(['Rapport Thuis Coach', 'Rapport Thuis Speler']);
  });
});
