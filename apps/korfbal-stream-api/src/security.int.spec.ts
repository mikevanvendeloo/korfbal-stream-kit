import fs from 'node:fs';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import path from 'node:path';
import request from 'supertest';
import ExcelJS from 'exceljs';
import express from 'express';
import {errorHandler} from './middleware/error';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import app from './main';
import {logger} from './utils/logger';
import {getAssetsRoot} from './services/config';
import {saveMatchSource} from './services/matchSchedule';
import {prisma as appPrisma} from './services/prisma';
import {MissingOrganizationContextError, runWithOrganization} from './services/organizationContext';
import {ensureOrganization, inTestOrganization, testDb as prisma, testOrganizationId, withoutOrganization} from '../test-helpers';
import {createProductionScenario, createTenantScenario, ProductionScenario, TenantScenario} from '../test-scenarios';

/**
 * Security tests for organizations (phase 1). Phase 2 adds API keys for the feed routes here.
 * Organization A ('sec-alpha') owns data; the tests act as the test organization unless they say otherwise.
 */
const runDb = process.env.REQUIRE_DB === 'true';
const MARKER = 'SecAlpha';
const A = 'sec-alpha';

/** 1x1 transparent PNG */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

describe('organization context (middleware)', () => {
  it('answers 401 "Kies een organisatie" without X-Organization on a tenant route', async () => {
    const res = await withoutOrganization(request(app).get('/api/sponsors'));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({error: 'Kies een organisatie'});
  });

  it('answers 401 for an empty or blank header', async () => {
    for (const value of ['', '   ']) {
      const res = await request(app).get('/api/persons').set('X-Organization', value);
      expect(res.status, JSON.stringify(value)).toBe(401);
    }
  });

  it.each([
    ['../test-org'],
    ['test-org/../fortuna'],
    ["test-org' OR '1'='1"],
    ['test-org;DROP TABLE "Sponsor"'],
    ['test-org%00'],
    ['TEST-ORG'],
    ['test_org'],
    ['-test-org'],
    ['x'.repeat(5000)],
  ])('rejects the odd slug %j with 403, never a 500', async (slug) => {
    const res = await request(app).get('/api/sponsors').set('X-Organization', slug);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({error: 'Onbekende of inactieve organisatie'});
  });

  it('answers 401 for a club\'s teams without an organization (they come from the own match schedule)', async () => {
    const res = await withoutOrganization(request(app).get('/api/clubs/1/teams'));
    expect(res.status).toBe(401);
  });

  it('allows X-Organization in CORS preflights', async () => {
    const res = await request(app).options('/api/sponsors');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain('X-Organization');
  });
});

describe.runIf(runDb)('organization context (integration)', () => {
  it('lets global routes through without an organization', async () => {
    for (const route of ['/api/organizations', '/api/seasons', '/api/clubs', '/api/players/images', '/api/openapi.json']) {
      const res = await withoutOrganization(request(app).get(route));
      expect(res.status, route).not.toBe(401);
      expect(res.status, route).toBeLessThan(500);
    }
  });

  it('lets global routes through with an unknown organization too (start screen with a stale choice)', async () => {
    const res = await request(app).get('/api/organizations').set('X-Organization', 'no-such-org');
    expect(res.status).toBe(200);
  });

  it('answers 403 for an unknown and for an inactive organization', async () => {
    expect((await request(app).get('/api/sponsors').set('X-Organization', 'does-not-exist')).status).toBe(403);
    const inactive = await prisma.organization.upsert({
      where: {slug: 'sec-inactive'}, update: {isActive: false}, create: {slug: 'sec-inactive', name: 'Inactief', isActive: false},
    });
    try {
      const res = await request(app).get('/api/sponsors').set('X-Organization', 'sec-inactive');
      expect(res.status).toBe(403);
    } finally {
      await prisma.organization.delete({where: {id: inactive.id}});
    }
  });
});

describe.runIf(runDb)('Prisma extension (integration)', () => {
  it('throws for a query on a tenant table without an organization in the context', async () => {
    await expect(appPrisma.sponsor.findMany()).rejects.toBeInstanceOf(MissingOrganizationContextError);
    await expect(appPrisma.production.count()).rejects.toBeInstanceOf(MissingOrganizationContextError);
    await expect(appPrisma.sponsor.create({data: {name: 'X', type: 'premium', logoUrl: 'x.png', websiteUrl: 'https://x.example'}}))
      .rejects.toBeInstanceOf(MissingOrganizationContextError);
  });

  it('leaves global tables alone without a context', async () => {
    await expect(appPrisma.season.findMany()).resolves.toBeInstanceOf(Array);
    await expect(appPrisma.organization.findMany()).resolves.toBeInstanceOf(Array);
  });

  it('refuses an insert without organization in the database too (code that bypasses the extension)', async () => {
    await expect(appPrisma.$executeRawUnsafe(
      `INSERT INTO "Sponsor" ("name", "type", "logoUrl", "websiteUrl") VALUES ('Raw', 'premium', 'raw.png', 'https://raw.example')`,
    )).rejects.toThrow(/23502|organizationId is required/);
  });

  it('ignores organizationId in create and update data (mass assignment)', async () => {
    const other = await ensureOrganization(prisma, 'sec-mass', 'Mass');
    const own = await testOrganizationId();
    try {
      await runWithOrganization(own, async () => {
        const created = await appPrisma.sponsor.create({
          data: {organizationId: other, name: 'Mass sponsor', type: 'premium', logoUrl: 'mass.png', websiteUrl: 'https://mass.example'},
        });
        expect(created.organizationId).toBe(own);
        const updated = await appPrisma.sponsor.update({where: {id: created.id}, data: {organizationId: other, name: 'Mass sponsor 2'}});
        expect(updated.organizationId).toBe(own);
        await appPrisma.sponsor.updateMany({where: {id: created.id}, data: {organizationId: other}});
        expect((await appPrisma.sponsor.findUnique({where: {id: created.id}}))?.organizationId).toBe(own);
        await appPrisma.sponsor.delete({where: {id: created.id}});
      });
    } finally {
      await prisma.organization.delete({where: {id: other}});
    }
  });

  it('ignores organizationId in a request body', async () => {
    const other = await ensureOrganization(prisma, 'sec-mass-api', 'Mass API');
    try {
      const res = await request(app).post('/api/persons').send({name: 'Mass Persoon', gender: 'male', organizationId: other});
      expect(res.status).toBe(201);
      const row = await runWithOrganization(other, () => prisma.person.findFirst({where: {name: 'Mass Persoon'}}));
      expect(row).toBeNull();
      const own = await prisma.person.findUnique({where: {id: res.body.id}});
      expect(own?.organizationId).toBe(await testOrganizationId());
      await prisma.person.delete({where: {id: res.body.id}});
    } finally {
      await prisma.organization.delete({where: {id: other}});
    }
  });
});

describe.runIf(runDb)('relations of global models into tenant tables (integration)', () => {
  let a: TenantScenario;
  let own: ProductionScenario;
  let otherSeasonId: number;

  beforeAll(async () => {
    a = await createTenantScenario(prisma, await ensureOrganization(prisma, 'sec-global', 'Sec Global'), 'SecGlobal');
    own = await createProductionScenario(prisma, {match: {homeTeamName: 'SecGlobal Eigen'}});
    otherSeasonId = (await prisma.season.create({data: {startYear: 2087, name: '2087/2088'}})).id;
  });

  afterAll(async () => {
    await own?.cleanup();
    await a?.cleanup();
    await prisma.season.deleteMany({where: {id: otherSeasonId}});
  });

  const matchOfA = () => runWithOrganization(a.organizationId, () => prisma.matchSchedule.findUniqueOrThrow({where: {id: a.matchId}}));

  it('does not move another organization\'s match through a nested write on a season', async () => {
    const before = await matchOfA();
    await inTestOrganization(async () => {
      await expect(appPrisma.season.update({where: {id: otherSeasonId}, data: {matches: {connect: {id: a.matchId}}}})).rejects.toThrow();
      // set skips rows it can't find (refused or not, the match must stay where it is)
      await appPrisma.season.update({where: {id: otherSeasonId}, data: {matches: {set: [{id: a.matchId}]}}}).catch(() => null);
      await appPrisma.season.update({where: {id: before.seasonId}, data: {matches: {updateMany: {where: {id: a.matchId}, data: {homeTeamName: 'Overgenomen'}}}}});
      await appPrisma.season.update({where: {id: before.seasonId}, data: {matches: {deleteMany: {id: a.matchId}}}});
    });
    expect(await matchOfA()).toMatchObject({seasonId: before.seasonId, homeTeamName: before.homeTeamName});
  });

  it('includes and counts only the own organization\'s rows of a global model\'s tenant relation', async () => {
    const seasonId = (await matchOfA()).seasonId;
    const season = await inTestOrganization(() => appPrisma.season.findUniqueOrThrow({
      where: {id: seasonId}, include: {matches: {select: {id: true}}, _count: {select: {matches: true}}},
    }));
    const ids = season.matches.map((m) => m.id);
    expect(ids).not.toContain(a.matchId);
    expect(season._count.matches).toBe(ids.length);
    const ownCount = await prisma.matchSchedule.count({where: {seasonId}});
    expect(season._count.matches).toBe(ownCount);

    const player = await inTestOrganization(() => appPrisma.player.findUniqueOrThrow({where: {id: a.playerId}, include: {interviewSubjects: true}}));
    expect(player.interviewSubjects).toEqual([]);
    const organization = await inTestOrganization(() => appPrisma.organization.findUniqueOrThrow({where: {id: a.organizationId}, include: {sponsors: true}}));
    expect(organization.sponsors).toEqual([]);
  });

  it('throws when a tenant relation of a global model is touched without an organization', async () => {
    await expect(appPrisma.season.findMany({include: {matches: true}})).rejects.toBeInstanceOf(MissingOrganizationContextError);
    await expect(appPrisma.season.findMany({include: {_count: {select: {matches: true}}}})).rejects.toBeInstanceOf(MissingOrganizationContextError);
    await expect(appPrisma.season.update({where: {id: otherSeasonId}, data: {matches: {connect: {id: a.matchId}}}})).rejects.toBeInstanceOf(MissingOrganizationContextError);
    await expect(appPrisma.organization.findMany({include: {matchSource: true}})).rejects.toThrow(/can't be scoped/);
  });

  it('counts per organization in /api/seasons, and no matches without one', async () => {
    const seasonId = (await matchOfA()).seasonId;
    const countFor = async (req: request.Test) => ((await req).body as Array<{id: number; matchCount: number}>).find((s) => s.id === seasonId)?.matchCount;
    const asA = await countFor(request(app).get('/api/seasons').set('X-Organization', 'sec-global'));
    const asOwn = await countFor(request(app).get('/api/seasons'));
    expect(asA).toBe(await runWithOrganization(a.organizationId, () => prisma.matchSchedule.count({where: {seasonId}})));
    expect(asOwn).toBe(await prisma.matchSchedule.count({where: {seasonId}}));
    expect(await countFor(withoutOrganization(request(app).get('/api/seasons')))).toBe(0);
  });
});

describe.runIf(runDb)('foreign ids in request bodies (integration)', () => {
  let a: TenantScenario;
  let own: ProductionScenario;
  let ownPersonId: number;

  beforeAll(async () => {
    a = await createTenantScenario(prisma, await ensureOrganization(prisma, A, 'Sec Alpha'), MARKER);
    own = await createProductionScenario(prisma, {items: [{title: 'Sec own item', positions: ['Sec Own Positie']}]});
    ownPersonId = (await prisma.person.create({data: {name: 'Sec Own Persoon', gender: 'male'}})).id;
  });

  afterAll(async () => {
    await prisma.person.deleteMany({where: {id: ownPersonId}});
    await own?.cleanup();
    await a?.cleanup();
  });

  /** A rejection that is not an attach and not a crash */
  const refused = (res: request.Response) => {
    expect(res.status, res.text).toBeGreaterThanOrEqual(400);
    expect(res.status, res.text).toBeLessThan(500);
  };

  it('does not create a production for a match of another organization', async () => {
    refused(await request(app).post('/api/production').send({matchScheduleId: a.matchId}));
    expect(await prisma.production.count({where: {matchScheduleId: a.matchId}})).toBe(0);
  });

  it('does not add a person or position of another organization to the own production', async () => {
    refused(await request(app).post(`/api/production/${own.productionId}/persons`).send({personId: a.personId}));
    refused(await request(app).post(`/api/production/${own.productionId}/person-positions`).send({personId: a.personId, positionId: a.positionId}));
    refused(await request(app).post(`/api/production/${own.productionId}/person-positions`).send({personId: ownPersonId, positionId: a.positionId}));
    refused(await request(app).put(`/api/production/${own.productionId}/person-positions`).send({personId: ownPersonId, positionIds: [a.positionId]}));
    expect(await prisma.productionPerson.count({where: {productionId: own.productionId}})).toBe(0);
    expect(await prisma.productionPersonPosition.count({where: {productionId: own.productionId}})).toBe(0);
  });

  it('does not give the own person a skill of another organization', async () => {
    refused(await request(app).post(`/api/persons/${ownPersonId}/skills`).send({skillId: a.skillId}));
    expect(await prisma.personSkill.count({where: {personId: ownPersonId}})).toBe(0);
  });

  it('does not link an own position to a skill or default segment of another organization', async () => {
    refused(await request(app).post('/api/production/positions').send({name: 'Sec Nieuwe Positie', skillId: a.skillId}));
    refused(await request(app).put('/api/production/segment-default-positions').send({segmentName: 'Sec Segment', positions: [{positionId: a.positionId, order: 1}]}));
    expect(await prisma.position.count({where: {name: 'Sec Nieuwe Positie'}})).toBe(0);
    expect(await prisma.segmentDefaultPosition.count({where: {segmentName: 'Sec Segment'}})).toBe(0);
  });

  it('does not apply a callsheet template of another organization to the own production', async () => {
    refused(await request(app).post(`/api/callsheets/templates/${a.callSheetTemplateId}/apply/${own.productionId}`).send({mode: 'replace'}));
    expect(await prisma.callSheet.count({where: {productionId: own.productionId}})).toBe(0);
    expect(await prisma.production.findUnique({where: {id: own.productionId}})).toMatchObject({callSheetTemplateId: null});
  });

  it('does not assign a person or position of another organization to an own segment', async () => {
    const segment = await prisma.productionSegment.create({data: {productionId: own.productionId, naam: 'Sec seg', volgorde: 1, duurInMinuten: 10}});
    refused(await request(app).post(`/api/production/segments/${segment.id}/assignments`).send({personId: a.personId, positionId: a.positionId}));
    expect(await prisma.segmentRoleAssignment.count({where: {productionSegmentId: segment.id}})).toBe(0);
  });

  it('does not add an event with a position of another organization', async () => {
    refused(await request(app).post(`/api/production/${own.productionId}/events`).send({title: 'Sec event', order: 9, positionIds: [a.positionId]}));
    expect(await prisma.productionEvent.count({where: {productionId: own.productionId, title: 'Sec event'}})).toBe(0);
  });

  it('refuses a cross-organization reference in the database even when the code forgets to check', async () => {
    await expect(prisma.productionEventPosition.create({data: {eventId: own.eventIds[0], positionId: a.positionId}}))
      .rejects.toThrow();
    await expect(prisma.matchRoleAssignment.create({data: {matchScheduleId: own.matchId, personId: a.personId, skillId: a.skillId}}))
      .rejects.toThrow();
  });
});

describe.runIf(runDb)('callsheet item ids are chosen by the server (integration)', () => {
  let a: TenantScenario;
  let own: ProductionScenario;
  let callSheetId: number;

  beforeAll(async () => {
    a = await createTenantScenario(prisma, await ensureOrganization(prisma, 'sec-items', 'Sec Items'), 'SecItems');
    own = await createProductionScenario(prisma, {items: [], segments: [{naam: 'Sec Items Segment', duurInMinuten: 10}]});
    callSheetId = (await prisma.callSheet.create({data: {productionId: own.productionId, name: 'Sec Items Callsheet'}})).id;
  });

  afterAll(async () => {
    await prisma.callSheet.deleteMany({where: {productionId: own.productionId}});
    await own?.cleanup();
    await a?.cleanup();
  });

  const itemOfA = () => runWithOrganization(a.organizationId, () => prisma.callSheetItem.findUnique({where: {id: a.callSheetItemId}}));

  it('ignores a client id when creating an item: no 409 for another organization\'s id (no existence oracle)', async () => {
    const before = await itemOfA();
    const responses = [];
    for (const id of [a.callSheetItemId, 'sec-items-does-not-exist']) {
      const res = await request(app).post(`/api/production/callsheets/${callSheetId}/items`).send({id, cue: 'C1', title: 'Sec item', durationSec: 10});
      expect(res.status, res.text).toBe(201);
      expect(res.body.id).not.toBe(id);
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
      responses.push(res);
    }
    // A child of an own item keeps its parent
    const child = await request(app).post(`/api/production/callsheets/${callSheetId}/items`)
      .send({cue: 'C2', title: 'Sec child', durationSec: 5, parentId: responses[0].body.id});
    expect(child.status).toBe(201);
    expect(child.body.parentId).toBe(responses[0].body.id);
    expect(await itemOfA()).toEqual(before);
  });

  it('ignores the ID column of an Excel import (an export of another organization imports fine)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Callsheet');
    sheet.columns = ['ID', 'Segment', 'Cue', 'Title', 'Duration'].map((header) => ({header, key: header}));
    sheet.addRow({ID: a.callSheetItemId, Segment: 'Sec Items Segment', Cue: 'X1', Title: 'Sec geimporteerd', Duration: 30});
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    const before = await itemOfA();

    const res = await request(app).post(`/api/production/${own.productionId}/callsheets/import-excel`)
      .attach('file', file, {filename: 'callsheet.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    expect(res.status, res.text).toBe(201);
    expect(res.body.items).toBe(1);
    const imported = await prisma.callSheetItem.findFirstOrThrow({where: {callSheetId: res.body.callSheet.id}});
    expect(imported.id).not.toBe(a.callSheetItemId);
    expect(await itemOfA()).toEqual(before);
  });
});

describe.runIf(runDb)('secrets (integration)', () => {
  const TOKEN = 'sec-token-9f8e7d6c5b4a';
  let organizationA: number;

  beforeAll(async () => {
    organizationA = await ensureOrganization(prisma, 'sec-secret', 'Sec Secret');
  });

  afterAll(async () => {
    await prisma.matchSource.deleteMany({});
    await prisma.organization.deleteMany({where: {id: organizationA}});
  });

  it('never returns the match source token, and never logs it', async () => {
    const logged: string[] = [];
    const capture = (...args: unknown[]) => void logged.push(JSON.stringify(args));
    const spies = [vi.spyOn(logger, 'info').mockImplementation(capture as never), vi.spyOn(logger, 'warn').mockImplementation(capture as never),
      vi.spyOn(logger, 'error').mockImplementation(capture as never), vi.spyOn(logger, 'debug').mockImplementation(capture as never)];
    try {
      const put = await request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl: 'http://127.0.0.1:9/v1', apiToken: TOKEN});
      expect(put.status).toBe(200);
      expect(put.body).toMatchObject({hasApiToken: true, configured: true});
      const responses = [put, await request(app).get('/api/match-source'), await request(app).post('/api/match-source/test')];
      // Without a new token the stored one stays
      responses.push(await request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl: 'http://127.0.0.1:9/v1'}));
      expect(responses.at(-1)?.body.hasApiToken).toBe(true);
      responses.push(await request(app).post('/api/match/matches/schedule/import'));
      for (const route of ['matches', 'persons', 'positions', 'producties', 'segment-templates', 'settings', 'skills', 'sponsors', 'clubs']) {
        responses.push(await request(app).get(`/api/backup/${route}/export`));
      }
      for (const res of responses) expect(res.text, res.req?.path).not.toContain(TOKEN);
      expect(logged.join('\n')).not.toContain(TOKEN);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }

    // null removes the token
    const cleared = await request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl: 'http://127.0.0.1:9/v1', apiToken: null});
    expect(cleared.body.hasApiToken).toBe(false);
  });

  it('keeps one organization\'s match source away from another', async () => {
    await runWithOrganization(organizationA, () => prisma.matchSource.create({data: {baseUrl: 'https://sec-secret.example', apiToken: TOKEN}}));
    const res = await request(app).get('/api/match-source');
    expect(res.text).not.toContain('sec-secret.example');
    expect(res.text).not.toContain(TOKEN);
  });

  it('rejects a match source that is not http(s)', async () => {
    const res = await request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl: 'file:///etc/passwd'});
    expect(res.status).toBe(400);
  });
});

/** A local HTTP server that records the requests it gets and answers with `answer`. */
async function recordingServer(answer: {status: number; body: string}) {
  const requests: http.IncomingHttpHeaders[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.headers);
    res.writeHead(answer.status, {'content-type': 'application/json'});
    res.end(answer.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  return {url, requests, close: () => new Promise<void>((resolve) => server.close(() => resolve()))};
}

describe.runIf(runDb)('match source token and address (integration)', () => {
  const TOKEN = 'sec-match-token-1a2b3c4d';
  const put = (body: Record<string, unknown>) => request(app).put('/api/match-source').send({provider: 'vrijwilligers', ...body});
  const storedToken = async () => (await prisma.matchSource.findFirst())?.apiToken ?? null;

  afterAll(async () => {
    await prisma.matchSource.deleteMany({});
  });

  it('removes the stored token when baseUrl moves to another origin without a new token', async () => {
    const own = await recordingServer({status: 200, body: '[]'});
    const attacker = await recordingServer({status: 200, body: '[]'});
    try {
      expect((await put({baseUrl: own.url, apiToken: TOKEN})).body.hasApiToken).toBe(true);
      const moved = await put({baseUrl: attacker.url});
      expect(moved.status).toBe(200);
      expect(moved.body.hasApiToken).toBe(false);
      expect(await storedToken()).toBeNull();

      expect((await request(app).post('/api/match-source/test')).status).toBe(200);
      await request(app).post('/api/match/matches/schedule/import');
      expect(attacker.requests.length).toBeGreaterThan(0);
      expect(attacker.requests.map((h) => h.authorization)).toEqual(attacker.requests.map(() => undefined));
    } finally {
      await own.close();
      await attacker.close();
    }
  });

  it('keeps the token for another path on the same origin, and takes a new token with a new origin', async () => {
    expect((await put({baseUrl: 'https://wedstrijden.example/v1', apiToken: TOKEN})).body.hasApiToken).toBe(true);
    expect((await put({baseUrl: 'https://wedstrijden.example/v2'})).body.hasApiToken).toBe(true);
    expect(await storedToken()).toBe(TOKEN);
    expect((await put({baseUrl: 'https://andere.example/v1', apiToken: 'nieuw-token'})).body.hasApiToken).toBe(true);
    expect(await storedToken()).toBe('nieuw-token');
  });

  it('removes the token when the provider changes without a new token', async () => {
    await put({baseUrl: 'https://wedstrijden.example/v1', apiToken: TOKEN});
    // Only one provider exists yet, so straight on the service
    const saved = await inTestOrganization(() => saveMatchSource({provider: 'sportlink' as never, baseUrl: 'https://wedstrijden.example/v1'}));
    expect(saved.apiToken).toBeNull();
  });

  it('answers the connection test with only ok or failed, nothing of the upstream answer', async () => {
    const answers = [
      {status: 418, body: JSON.stringify({error: 'upstream-detail-xyz', echo: TOKEN})},
      {status: 200, body: '"html-page"'},
    ];
    for (const answer of answers) {
      const upstream = await recordingServer(answer);
      try {
        await put({baseUrl: upstream.url, apiToken: TOKEN});
        const failed = await request(app).post('/api/match-source/test');
        expect(failed.status).toBe(502);
        expect(failed.body).toEqual({ok: false, error: 'Geen verbinding met de wedstrijdbron'});
      } finally {
        await upstream.close();
      }
    }
    const working = await recordingServer({status: 200, body: '[]'});
    try {
      await put({baseUrl: working.url, apiToken: TOKEN});
      expect((await request(app).post('/api/match-source/test')).body).toEqual({ok: true});
    } finally {
      await working.close();
    }
  });

  it('accepts only https in production (http only for local mocks outside production)', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect((await put({baseUrl: 'http://wedstrijden.example/v1'})).status).toBe(400);
      expect((await put({baseUrl: 'https://wedstrijden.example/v1', isEnabled: true})).status).toBe(200);
      // A row from before the check is not used either
      await prisma.matchSource.updateMany({data: {baseUrl: 'http://wedstrijden.example/v1'}});
      expect((await request(app).post('/api/match-source/test')).status).toBe(409);
    } finally {
      process.env.NODE_ENV = previous;
    }
    expect((await put({baseUrl: 'http://127.0.0.1:9/v1'})).status).toBe(200);
    for (const baseUrl of ['ftp://wedstrijden.example', 'javascript:alert(1)', 'file:///etc/passwd']) {
      expect((await put({baseUrl})).status, baseUrl).toBe(400);
    }
  });
});

describe.runIf(runDb)('error responses without internals (integration)', () => {
  /** A one-route app with the real error handler, for errors the real client throws */
  const probe = (fn: () => Promise<unknown>) => {
    const probeApp = express();
    probeApp.get('/probe', async (_req, res, next) => {
      try {
        await fn();
        res.json({ok: true});
      } catch (err) {
        next(err);
      }
    });
    probeApp.use(errorHandler);
    return request(probeApp).get('/probe');
  };
  const INTERNALS = /prisma|invocation|constraint|organizationId|runWithOrganization|Sponsor|column|23502|SELECT|INSERT/i;

  beforeAll(() => {
    // Keep the expected errors out of the test output
    vi.spyOn(logger, 'error').mockImplementation(() => logger);
    vi.spyOn(logger, 'warn').mockImplementation(() => logger);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.skill.deleteMany({where: {code: 'SEC_ERR_SKILL'}});
  });

  it('answers a unique violation with 409 and a generic message', async () => {
    const create = () => inTestOrganization(() => appPrisma.skill.create({data: {code: 'SEC_ERR_SKILL', name: 'Sec err', nameMale: 'm', nameFemale: 'v'}}));
    await create();
    const res = await probe(create);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({error: 'Bestaat al'});
  });

  it('answers other database and code errors with 500 "Interne serverfout"', async () => {
    const failures = [
      () => appPrisma.sponsor.findMany(), // no organization in the context
      () => inTestOrganization(() => appPrisma.sponsor.create({data: {name: 1} as never})), // validation error
      () => appPrisma.$executeRawUnsafe(`INSERT INTO "Sponsor" ("name", "type", "logoUrl", "websiteUrl") VALUES ('Raw', 'premium', 'raw.png', 'https://raw.example')`),
      () => appPrisma.$queryRawUnsafe('SELECT * FROM "NoSuchTable"'),
      async () => {
        throw new Error('ECONNREFUSED 10.0.0.5:8088');
      },
    ];
    for (const failure of failures) {
      const res = await probe(failure);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({error: 'Interne serverfout'});
      expect(res.text).not.toMatch(INTERNALS);
    }
  });

  it('answers a missing row with 404, without the Prisma message', async () => {
    const res = await probe(() => inTestOrganization(() => appPrisma.sponsor.update({where: {id: 2147483000}, data: {name: 'x'}})));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({error: 'Niet gevonden'});
  });
});

describe.runIf(runDb)('backup and restore per organization (integration)', () => {
  let a: TenantScenario;

  beforeAll(async () => {
    a = await createTenantScenario(prisma, await ensureOrganization(prisma, 'sec-backup', 'Sec Backup'), 'SecBackup');
  });

  afterAll(async () => {
    await prisma.production.deleteMany({where: {matchSchedule: {homeTeamName: {startsWith: 'SecBackup'}}}});
    await prisma.matchSchedule.deleteMany({where: {homeTeamName: {startsWith: 'SecBackup'}}});
    await prisma.sponsor.deleteMany({where: {name: {startsWith: 'SecBackup'}}});
    await prisma.person.deleteMany({where: {name: {startsWith: 'SecBackup'}}});
    await prisma.position.deleteMany({where: {name: {startsWith: 'SecBackup'}}});
    await prisma.skill.deleteMany({where: {name: {startsWith: 'SecBackup'}}});
    await a?.cleanup();
  });

  it('exports nothing of another organization', async () => {
    for (const route of ['matches', 'persons', 'positions', 'producties', 'segment-templates', 'settings', 'skills', 'sponsors']) {
      const res = await request(app).get(`/api/backup/${route}/export`);
      expect(res.status, route).toBe(200);
      expect(res.text, route).not.toContain('SecBackup');
    }
  });

  it('restores another organization\'s export into the chosen organization only', async () => {
    const exported = await request(app).get('/api/backup/sponsors/export').set('X-Organization', 'sec-backup');
    expect(exported.text).toContain('SecBackup');
    const productions = await request(app).get('/api/backup/producties/export').set('X-Organization', 'sec-backup');
    const tampered = (exported.body as Array<Record<string, unknown>>).map((s) => ({...s, organizationId: a.organizationId, websiteUrl: 'https://overgenomen.example'}));

    expect((await request(app).post('/api/backup/sponsors/import').send(tampered)).status).toBe(200);
    expect((await request(app).post('/api/backup/producties/import').send(productions.body)).status).toBe(200);

    // A is untouched
    await runWithOrganization(a.organizationId, async () => {
      expect((await prisma.sponsor.findUnique({where: {id: a.sponsorId}}))?.websiteUrl).toBe('https://example.com');
      expect(await prisma.production.count()).toBe(1);
      expect(await prisma.sponsor.count()).toBe(1);
    });
    // The copies are in the test organization
    const ownSponsor = await prisma.sponsor.findFirst({where: {name: 'SecBackup Sponsor'}});
    expect(ownSponsor?.organizationId).toBe(await testOrganizationId());
    expect(ownSponsor?.websiteUrl).toBe('https://overgenomen.example');
    expect(await prisma.production.count({where: {matchSchedule: {homeTeamName: 'SecBackup Thuis'}}})).toBe(1);
  });
});

describe.runIf(runDb)('uploads (integration)', () => {
  let organizationId: number;
  let sponsorId: number;
  const root = () => getAssetsRoot();

  beforeAll(async () => {
    organizationId = await testOrganizationId();
    sponsorId = (await prisma.sponsor.create({data: {name: 'Sec Upload Sponsor', type: 'goud', logoUrl: 'x.png', websiteUrl: 'https://x.example'}})).id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({where: {id: sponsorId}});
    await prisma.organization.update({where: {id: organizationId}, data: {logoUrl: null}});
  });

  it('stores an organization logo as organizations/<id>.<ext>, whatever the file is called', async () => {
    const before = new Set(filesUnder(root()));
    const res = await request(app).post(`/api/organizations/${organizationId}/logo`).attach('file', PNG, {filename: '../../../evil.png', contentType: 'image/png'});
    expect(res.status, res.text).toBe(200);
    expect(res.body.logoUrl).toBe(`organizations/${organizationId}.png`);
    const added = filesUnder(root()).filter((f) => !before.has(f));
    expect(added.every((f) => f.startsWith(path.join(root(), 'organizations') + path.sep))).toBe(true);
    expect(fs.existsSync(path.join(root(), 'organizations', `${organizationId}.png`))).toBe(true);
  });

  it('does not let a new organization with a freed slug overwrite the old organization\'s logo', async () => {
    const old = await ensureOrganization(prisma, 'sec-slug-old', 'Oud');
    let reused: number | undefined;
    try {
      expect((await request(app).post(`/api/organizations/${old}/logo`).attach('file', PNG, {filename: 'a.png', contentType: 'image/png'})).status).toBe(200);
      const oldFile = path.join(root(), 'organizations', `${old}.png`);
      const oldBytes = fs.readFileSync(oldFile);
      expect((await request(app).put(`/api/organizations/${old}`).send({slug: 'sec-slug-renamed'})).status).toBe(200);
      reused = (await request(app).post('/api/organizations').send({name: 'Nieuw', slug: 'sec-slug-old'})).body.id;
      const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      const res = await request(app).post(`/api/organizations/${reused}/logo`).attach('file', gif, {filename: 'b.gif', contentType: 'image/gif'});
      expect(res.body.logoUrl).toBe(`organizations/${reused}.gif`);
      expect(fs.readFileSync(oldFile).equals(oldBytes)).toBe(true);
      expect((await prisma.organization.findUnique({where: {id: old}}))?.logoUrl).toBe(`organizations/${old}.png`);
    } finally {
      await prisma.organization.deleteMany({where: {id: {in: [old, reused ?? -1]}}});
    }
  });

  it('refuses non-images for the organization logo, also when they claim to be one', async () => {
    const html = Buffer.from('<script>alert(1)</script>');
    expect((await request(app).post(`/api/organizations/${organizationId}/logo`).attach('file', html, {filename: 'x.html', contentType: 'text/html'})).status).toBe(400);
    expect((await request(app).post(`/api/organizations/${organizationId}/logo`).attach('file', html, {filename: 'x.png', contentType: 'image/png'})).status).toBe(400);
    expect((await request(app).post(`/api/organizations/${organizationId}/logo`).attach('file', html, {filename: 'x.svg', contentType: 'image/svg+xml'})).status).toBe(400);
  });

  it('refuses organization slugs that could leave the logo directory', async () => {
    for (const slug of ['../evil', 'a/b', 'a\\b', '..', '.', 'evil%2F..', 'evil.png']) {
      const res = await request(app).post('/api/organizations').send({name: 'Evil', slug});
      expect(res.status, slug).toBe(400);
    }
    expect((await request(app).put(`/api/organizations/${organizationId}`).send({slug: '../evil'})).status).toBe(400);
  });

  it('stores a sponsor logo in the organization\'s own directory (by id), whatever the file is called', async () => {
    const res = await request(app).post(`/api/sponsors/${sponsorId}/logo`).attach('file', PNG, {filename: '../../../../etc/evil.png', contentType: 'image/png'});
    expect(res.status, res.text).toBe(200);
    expect(res.body.logoUrl).toBe(`${organizationId}/sec-upload-sponsor.png`);
    expect(fs.existsSync(path.join(root(), 'sponsors', String(organizationId), 'sec-upload-sponsor.png'))).toBe(true);
    expect(fs.existsSync(path.join(root(), 'etc', 'evil.png'))).toBe(false);
  });

  it('never derives a sponsor logo from the name (that is a shared legacy file), and keeps an upload on rename', async () => {
    const legacy = path.join(root(), 'sponsors', 'sec-legacy-sponsor.png');
    fs.mkdirSync(path.dirname(legacy), {recursive: true});
    fs.writeFileSync(legacy, PNG);
    try {
      const created = await request(app).post('/api/sponsors').send({name: 'Sec Legacy Sponsor', type: 'goud', websiteUrl: 'https://legacy.example'});
      expect(created.status).toBe(201);
      expect(created.body.logoUrl).toBeNull();
      expect((await request(app).post('/api/sponsors').send({name: 'Sec Legacy 2', type: 'goud', websiteUrl: 'https://legacy.example', logoUrl: 'sec-legacy-sponsor.png'})).status).toBe(400);
      await prisma.sponsor.delete({where: {id: created.body.id}});
    } finally {
      fs.rmSync(legacy, {force: true});
    }
    const renamed = await request(app).put(`/api/sponsors/${sponsorId}`).send({name: 'Sec Upload Sponsor Nieuw'});
    expect(renamed.body.logoUrl).toBe(`${organizationId}/sec-upload-sponsor.png`);
    // The edit form sends the current value back
    expect((await request(app).put(`/api/sponsors/${sponsorId}`).send({name: 'Sec Upload Sponsor', logoUrl: renamed.body.logoUrl})).body.logoUrl)
      .toBe(`${organizationId}/sec-upload-sponsor.png`);
  });

  it('does not take over another organization\'s logo through a client logoUrl, also not in an import', async () => {
    const other = await ensureOrganization(prisma, 'sec-logo-other', 'Logo Ander');
    try {
      const foreign = `${other}/hun-logo.png`;
      expect((await request(app).put(`/api/sponsors/${sponsorId}`).send({logoUrl: foreign})).status).toBe(400);
      expect((await request(app).post('/api/sponsors').send({name: 'Sec Foreign', type: 'goud', websiteUrl: 'https://f.example', logoUrl: foreign})).status).toBe(400);
      expect((await request(app).post('/api/backup/sponsors/import').send([{name: 'Sec Foreign', type: 'goud', websiteUrl: 'https://f.example', logoUrl: foreign}])).status).toBe(200);
      expect((await prisma.sponsor.findFirst({where: {name: 'Sec Foreign'}}))?.logoUrl).toBeNull();
      // A backup from before organizations keeps its plain file names (shown only; nothing writes there)
      await request(app).post('/api/backup/sponsors/import').send([{name: 'Sec Legacy Restore', type: 'goud', websiteUrl: 'https://l.example', logoUrl: 'oud-logo.png'}]);
      expect((await prisma.sponsor.findFirst({where: {name: 'Sec Legacy Restore'}}))?.logoUrl).toBe('oud-logo.png');
      expect((await prisma.sponsor.findUnique({where: {id: sponsorId}}))?.logoUrl).toBe(`${organizationId}/sec-upload-sponsor.png`);
    } finally {
      await prisma.sponsor.deleteMany({where: {name: {in: ['Sec Foreign', 'Sec Legacy Restore']}}});
      await prisma.organization.delete({where: {id: other}});
    }
  });

  it('has no generic upload endpoint (it kept .html/.svg and served them same-origin: stored XSS)', async () => {
    const before = new Set(filesUnder(root()));
    const res = await request(app).post('/api/upload').attach('file', Buffer.from('<script>alert(1)</script>'), {filename: 'x.html', contentType: 'text/html'});
    expect(res.status).toBe(404);
    expect(filesUnder(root()).filter((f) => !before.has(f))).toEqual([]);
  });

  it('refuses non-images for a sponsor logo', async () => {
    const html = Buffer.from('<html></html>');
    expect((await request(app).post(`/api/sponsors/${sponsorId}/logo`).attach('file', html, {filename: 'x.html', contentType: 'text/html'})).status).toBe(400);
    expect((await request(app).post(`/api/sponsors/${sponsorId}/logo`).attach('file', html, {filename: 'x.png', contentType: 'image/png'})).status).toBe(400);
    expect((await prisma.sponsor.findUnique({where: {id: sponsorId}}))?.logoUrl).toBe(`${organizationId}/sec-upload-sponsor.png`);
  });
});
