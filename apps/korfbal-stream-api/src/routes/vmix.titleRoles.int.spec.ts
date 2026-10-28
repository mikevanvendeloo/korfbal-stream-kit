import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {applyStandardSetToTestOrganization, ensureOrganization, testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';
const EMPTY = [{functionName: '', name: ''}];

describe.runIf(runDb)('vMix title per role of the active production (integration)', () => {
  let show: ProductionScenario;
  const emptySlug = `titelrol-leeg-${Date.now()}`;

  const title = (role: string) => request(app).get(`/api/vmix/production/active/titles/${role}`);

  beforeAll(async () => {
    await applyStandardSetToTestOrganization();
    show = await createProductionScenario(prisma, {
      active: true,
      items: [],
      match: {homeTeamName: 'Titelrol Thuis 1', awayTeamName: 'Titelrol Uit 1'},
      crew: [{name: 'Pien Presentator', skills: ['PRESENTATIE']}, {name: 'Arie Analist', skills: ['ANALIST']}],
      interviews: [{side: 'AWAY', role: 'COACH', name: 'Generieke Coach'}, {side: 'AWAY', role: 'COACH', name: 'Titel Coach'}],
    });
    const {productionId} = show;
    // Presenter and analyst on their (entertainment) positions in this production
    for (const [person, code] of [['Pien Presentator', 'PRESENTATIE'], ['Arie Analist', 'ANALIST']]) {
      const position = await prisma.position.findFirst({where: {skill: {code}}});
      await prisma.productionPersonPosition.create({data: {productionId, personId: show.personIds[person], positionId: Number(position?.id)}});
    }
    // The production's own titles; "Titel Coach" is chosen for the away-coach title itself, "Generieke Coach" for any
    await prisma.titleDefinition.create({data: {productionId, name: 'Commentaar', order: 1, parts: {create: [{sourceType: 'COMMENTARY'}]}}});
    const coachTitle = await prisma.titleDefinition.create({data: {productionId, name: 'Uit coach', order: 2, parts: {create: [{sourceType: 'TEAM_COACH', teamSide: 'AWAY'}]}}});
    await prisma.interviewSubject.updateMany({where: {productionId, playerId: show.playerIds['Titel Coach']}, data: {titleDefinitionId: coachTitle.id}});
    await ensureOrganization(prisma, emptySlug);
  });

  afterAll(async () => {
    await prisma.interviewSubject.deleteMany({where: {productionId: show.productionId}});
    await show.cleanup();
    await prisma.organization.deleteMany({where: {slug: emptySlug}});
  });

  it('gives the presenter, also without a title for that role', async () => {
    const res = await title('presentatie');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{functionName: 'Presentatie', name: 'Pien Presentator'}]);
  });

  it('gives presenter and analyst together', async () => {
    expect((await title('presentatie-analist')).body).toEqual([{functionName: 'Presentatie & analist', name: 'Pien Presentator & Arie Analist'}]);
  });

  it('gives the coach chosen for the title of that role, case-insensitively', async () => {
    const res = await title('Coach-Uit');
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({functionName: expect.stringMatching(/^Coach/), name: 'Titel Coach'});
  });

  it('gives an empty row when nobody is chosen for the role', async () => {
    expect((await title('coach-thuis')).body).toEqual(EMPTY);
    expect((await title('commentaar')).body).toEqual(EMPTY);
  });

  it('gives an empty row for an unknown role', async () => {
    for (const role of ['keeper', 'constructor', '__proto__']) {
      const res = await title(role);
      expect(res.status, role).toBe(200);
      expect(res.body, role).toEqual(EMPTY);
    }
  });

  it('gives an empty row without an active production', async () => {
    const res = await title('presentatie').set('X-Organization', emptySlug);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY);
  });

  it('keeps the full list of titles as it was', async () => {
    const res = await request(app).get('/api/vmix/production/active/titles');
    expect(res.body).toEqual([
      {functionName: 'Commentaar', name: null},
      expect.objectContaining({name: 'Titel Coach'}),
    ]);
  });

  it('is listed among the vMix data sources', async () => {
    const res = await request(app).get('/api/vmix/endpoints');
    expect(res.body.endpoints.map((e: {url: string}) => e.url)).toContainEqual(expect.stringMatching(/\/api\/vmix\/production\/active\/titles\/coach-uit\?key=<jouw-sleutel>$/));
  });
});
