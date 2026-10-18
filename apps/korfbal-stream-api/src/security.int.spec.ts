import fs from 'node:fs';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import path from 'node:path';
import request from 'supertest';
import ExcelJS from 'exceljs';
import express from 'express';
import {errorHandler} from './middleware/error';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import {io as ioClient, Socket as ClientSocket} from 'socket.io-client';
import app, {httpServer} from './main';
import * as liveState from './services/productionState';
import {timeSyncService} from './services/timeSyncService';
import {hasPushMemory, pushForActiveOrganizations} from './services/vmixCallsheetPush';
import {syncVenueClocks, venueClockSyncService} from './services/venueClockSyncService';
import {setSetting} from './services/appSettings';
import {hashApiKey, LAST_USED_WRITE_INTERVAL_MS} from './services/apiKeys';
import {isSameOriginRequest} from './middleware/sameOrigin';
import {clearOrganizationLookupCache, ORGANIZATION_LOOKUP_TTL_MS} from './middleware/organizationContext';
import {logger} from './utils/logger';
import {getAssetsRoot} from './services/config';
import {saveMatchSource} from './services/matchSchedule';
import {recordingServer} from './test-support/recordingServer';
import {prisma as appPrisma, prismaUnscoped} from './services/prisma';
import {MissingOrganizationContextError, runWithOrganization} from './services/organizationContext';
import {ensureOrganization, inTestOrganization, recordQueries, TEST_ORGANIZATION_SLUG, testDb as prisma, testOrganizationId, withoutOrganization} from '../test-helpers';
import {createProductionScenario, createTenantScenario, ProductionScenario, TenantScenario} from '../test-scenarios';

/**
 * Security tests for organizations: isolation (phase 1), live state per organization, socket rooms,
 * background services and API keys on the feed routes (phase 2).
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
    expect(res.body).toEqual({error: 'Kies een organisatie', code: 'ORGANIZATION_REQUIRED'});
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
    expect(res.body).toEqual({error: 'Onbekende of inactieve organisatie', code: 'ORGANIZATION_UNKNOWN'});
  });

  it('answers 401 for a club\'s teams without an organization (they come from the own match schedule)', async () => {
    const res = await withoutOrganization(request(app).get('/api/clubs/1/teams'));
    expect(res.status).toBe(401);
  });

  it('allows no cross-origin use of the Beheer/LIVE API (the frontend is same-origin)', async () => {
    const res = await request(app).options('/api/sponsors').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect((await request(app).get('/api/sponsors').set('Origin', 'https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows feeds and static files cross-origin, with X-Api-Key', async () => {
    const res = await withoutOrganization(request(app).options('/api/vmix/sponsor-names'));
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-headers']).toContain('X-Api-Key');
    expect(res.headers['access-control-allow-headers']).not.toContain('X-Organization');
    expect((await request(app).get('/uploads/none.png')).headers['access-control-allow-origin']).toBe('*');
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

  it('keeps the same-organization trigger working under another search_path (e.g. a pg_dump import)', async () => {
    const own = await testOrganizationId();
    const other = await ensureOrganization(prisma, 'sec-search-path', 'Search path');
    const foreignSkill = await runWithOrganization(other, () =>
      prisma.skill.create({data: {code: 'SEC_SEARCH_PATH', name: 'Search path', nameMale: 'Search path', nameFemale: 'Search path'}}));
    const insertPosition = (skillId: number | null) => prismaUnscoped.$transaction(async (tx) => {
      // As a dump import does: nothing on the search_path, every table named with its schema
      await tx.$queryRawUnsafe(`SELECT set_config('search_path', '', true)`);
      await tx.$executeRawUnsafe(`INSERT INTO public."Position" ("organizationId", "name", "skillId") VALUES ($1, 'Search path positie', $2)`, own, skillId);
      throw new Error('rollback');
    });
    try {
      await expect(insertPosition(null)).rejects.toThrow('rollback');
      // And it still refuses a reference to another organization's row
      await expect(insertPosition(foreignSkill.id)).rejects.toThrow(/another organization/);
    } finally {
      await prisma.organization.delete({where: {id: other}});
    }
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

  it('answers a failing source with a category only: no upstream body, headers, exact status or token', async () => {
    // Upstreams that echo the Authorization header and their own details back
    const echo = (status: number) => (req: http.IncomingMessage) => ({
      status, body: JSON.stringify({statusCode: status, message: 'upstream-detail-xyz', authorization: req.headers.authorization, server: 'nginx/1.2.3'}),
    });
    const cases = [
      {answer: echo(500), code: 'SOURCE_SERVER_ERROR'},
      {answer: echo(503), code: 'SOURCE_SERVER_ERROR'},
      {answer: echo(401), code: 'SOURCE_UNAUTHORIZED'},
      {answer: echo(418), code: 'SOURCE_REJECTED'},
      {answer: () => ({status: 200, body: `<html>${TOKEN} upstream-detail-xyz</html>`, contentType: 'text/html'}), code: 'SOURCE_INVALID_RESPONSE'},
    ];
    const logged: string[] = [];
    const capture = (...args: unknown[]) => void logged.push(JSON.stringify(args));
    const spies = (['info', 'warn', 'error', 'debug'] as const).map((level) => vi.spyOn(logger, level).mockImplementation(capture as never));
    try {
      for (const {answer, code} of cases) {
        const upstream = await recordingServer(answer);
        try {
          await put({baseUrl: upstream.url, apiToken: TOKEN});
          for (const res of [await request(app).post('/api/match-source/test'), await request(app).post('/api/match/matches/schedule/import?date=08-02-2026')]) {
            expect(res.body, code).toEqual({ok: false, code, error: expect.any(String), hint: expect.any(String)});
            expect(res.text).not.toContain(TOKEN);
            expect(res.text).not.toContain('upstream-detail-xyz');
            expect(res.text).not.toContain('nginx');
            expect(res.text).not.toMatch(/\b(418|503)\b/);
            expect(res.headers['server']).toBeUndefined();
          }
          // The upstream did get the token: the echo really contained it
          expect(upstream.requests[0].authorization).toBe(`Bearer ${TOKEN}`);
        } finally {
          await upstream.close();
        }
      }
      // The server log has the details (status, body), but never the token
      const log = logged.join('\n');
      expect(log).toContain('upstream-detail-xyz');
      expect(log).toContain('"upstreamStatus":418');
      expect(log).toContain(`"organization":"${TEST_ORGANIZATION_SLUG}"`);
      expect(log).not.toContain(TOKEN);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
    const working = await recordingServer({status: 200, body: '[]'});
    try {
      await put({baseUrl: working.url, apiToken: TOKEN});
      expect((await request(app).post('/api/match-source/test')).body).toEqual({ok: true, matches: 0});
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

// ---------------------------------------------------------------------------------------------------
// Phase 2: live state per organization, socket rooms, background services, API keys
// ---------------------------------------------------------------------------------------------------

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 3000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** The app's Socket.io server, listening on a random port (supertest doesn't start it). */
async function socketServerUrl(): Promise<string> {
  if (!httpServer.listening) await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
}

type SocketRecorder = {socket: ClientSocket; events: Array<{event: string; payload: string}>};

/** A socket client like the browser's, recording every event it receives. */
function connectClient(url: string, auth: Record<string, unknown> = {}): Promise<SocketRecorder> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {transports: ['websocket'], auth, reconnection: false, forceNew: true});
    const events: SocketRecorder['events'] = [];
    socket.onAny((event: string, ...args: unknown[]) => events.push({event, payload: JSON.stringify(args)}));
    socket.once('connect', () => resolve({socket, events}));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

/** A recorded URL as text: vMix command values are form-encoded (space = +). */
const decodeQuery = (url: string) => decodeURIComponent(url.replace(/\+/g, ' '));

const GLOBAL_EVENTS = new Set(['heartbeat', 'season_changed']);

describe('socket handshake origin', () => {
  const req = (headers: Record<string, string>) => ({headers});

  it('lets same-origin browsers and clients without an Origin through', () => {
    expect(isSameOriginRequest(req({}))).toBe(true);
    expect(isSameOriginRequest(req({origin: 'http://streamz.local', host: 'streamz.local'}))).toBe(true);
    expect(isSameOriginRequest(req({origin: 'http://localhost:3333', host: 'localhost:3333'}))).toBe(true);
    expect(isSameOriginRequest(req({origin: 'https://streamz.local', host: 'streamz.local:443'}))).toBe(true);
    // The Vite proxy (dev 4200, e2e 4300) rewrites Host to the API's port and sends its own as X-Forwarded-Host (xfwd)
    expect(isSameOriginRequest(req({origin: 'http://localhost:4200', host: 'localhost:3333', 'x-forwarded-host': 'localhost:4200'}))).toBe(true);
    expect(isSameOriginRequest(req({origin: 'http://localhost:4300', host: 'localhost:3335', 'x-forwarded-host': 'localhost:4300'}))).toBe(true);
    expect(isSameOriginRequest(req({origin: 'http://192.168.1.5:4200', host: 'localhost:3333', 'x-forwarded-host': '192.168.1.5:4200'}))).toBe(true);
    // nginx forwards $host without the port: then only the hostname can be compared (documented)
    expect(isSameOriginRequest(req({origin: 'http://192.168.1.5', host: '192.168.1.5'}))).toBe(true);
    expect(isSameOriginRequest(req({origin: 'http://192.168.1.5:8080', host: '192.168.1.5'}))).toBe(true);
  });

  it('refuses a page on another host', () => {
    expect(isSameOriginRequest(req({origin: 'https://evil.example', host: 'streamz.local'}))).toBe(false);
    expect(isSameOriginRequest(req({origin: 'null', host: 'streamz.local'}))).toBe(false);
    expect(isSameOriginRequest(req({origin: 'http://streamz.local.evil.example', host: 'streamz.local'}))).toBe(false);
    expect(isSameOriginRequest(req({origin: 'file://streamz.local', host: 'streamz.local'}))).toBe(false);
    expect(isSameOriginRequest(req({origin: 'http://streamz.local'}))).toBe(false);
  });

  it('refuses a page on another port of the same host when the Host carries a port', () => {
    expect(isSameOriginRequest(req({origin: 'http://localhost:9999', host: 'localhost:3333'}))).toBe(false);
    expect(isSameOriginRequest(req({origin: 'http://localhost:9999', host: 'localhost:3333', 'x-forwarded-host': 'localhost:4200'}))).toBe(false);
    expect(isSameOriginRequest(req({origin: 'http://streamz.local', host: 'streamz.local:8080'}))).toBe(false);
    // The forwarded host is the one the browser used: it wins over Host
    expect(isSameOriginRequest(req({origin: 'http://localhost:3333', host: 'localhost:3333', 'x-forwarded-host': 'localhost:4200'}))).toBe(false);
  });
});

describe.runIf(runDb)('live state per organization (integration)', () => {
  const LA = 'sec-live-a';
  const LB = 'sec-live-b';
  const items = (name: string) => [{title: `${name} opening`}, {title: `${name} interview`}, {title: `${name} afsluiting`}];
  let orgA: number;
  let orgB: number;
  let a: ProductionScenario;
  let b: ProductionScenario;
  let clientA: SocketRecorder;
  let clientB: SocketRecorder;
  let clientNone: SocketRecorder;

  const asA = (r: request.Test) => r.set('X-Organization', LA);
  const asB = (r: request.Test) => r.set('X-Organization', LB);
  const stateOf = (organizationId: number) => runWithOrganization(organizationId, async () => liveState.liveStateSnapshot());
  const statuses = (organizationId: number, productionId: number) => runWithOrganization(organizationId, async () =>
    (await prisma.productionEvent.findMany({where: {productionId}, orderBy: {order: 'asc'}})).map((e) => e.status));

  beforeAll(async () => {
    orgA = await ensureOrganization(prisma, LA, 'Sec Live A');
    orgB = await ensureOrganization(prisma, LB, 'Sec Live B');
    a = await createProductionScenario(prisma, {organizationId: orgA, active: true, items: items('LiveA')});
    b = await createProductionScenario(prisma, {organizationId: orgB, active: true, items: items('LiveB')});
    const url = await socketServerUrl();
    [clientA, clientB, clientNone] = await Promise.all([connectClient(url, {organization: LA}), connectClient(url, {organization: LB}), connectClient(url)]);
  });

  afterAll(async () => {
    for (const s of [clientA, clientB, clientNone]) s?.socket.close();
    for (const [organizationId, show] of [[orgA, a], [orgB, b]] as const) {
      if (!show) continue;
      await runWithOrganization(organizationId, () => liveState.stopProduction(liveState.getActiveProductionId() ?? show.productionId));
      await runWithOrganization(organizationId, () => prisma.production.deleteMany({where: {matchScheduleId: show.matchId}}));
      await show.cleanup();
    }
    await prisma.organization.deleteMany({where: {slug: {in: [LA, LB]}}});
  });

  it('gives each organization its own active item and clock', async () => {
    expect((await asA(request(app).post(`/api/show/start/${a.productionId}`))).status).toBe(200);
    expect((await asB(request(app).post(`/api/show/start/${b.productionId}`))).status).toBe(200);
    await waitFor(async () => (await stateOf(orgA)).activeEventId === a.eventIds[0] && (await stateOf(orgB)).activeEventId === b.eventIds[0]);

    expect(await stateOf(orgA)).toMatchObject({productionId: a.productionId, activeEventId: a.eventIds[0], isClockRunning: true});
    expect(await stateOf(orgB)).toMatchObject({productionId: b.productionId, activeEventId: b.eventIds[0], isClockRunning: true});
    // The clocks tick on their own
    await waitFor(async () => (await stateOf(orgA)).clocks.productionTime > 0);
    expect((await stateOf(orgA)).clocks.productionTime).toBeGreaterThan(0);
  });

  it('can\'t start or stop another organization\'s production', async () => {
    expect((await asA(request(app).post(`/api/show/start/${b.productionId}`))).status).toBe(404);
    expect((await asA(request(app).post(`/api/show/stop/${b.productionId}`))).status).toBe(404);
    expect(await stateOf(orgB)).toMatchObject({productionId: b.productionId, isClockRunning: true});
  });

  it('moves only A on next in A', async () => {
    const res = await asA(request(app).post('/api/show/next'));
    expect(res.status).toBe(200);
    expect((await stateOf(orgA)).activeEventId).toBe(a.eventIds[1]);
    expect((await stateOf(orgB)).activeEventId).toBe(b.eventIds[0]);
    expect(await statuses(orgB, b.productionId)).toEqual(['ACTIVE', 'WAITING', 'WAITING']);
  });

  it('sends socket clients only their own organization\'s events', async () => {
    for (const c of [clientA, clientB, clientNone]) c.events.length = 0;
    await asB(request(app).post('/api/show/next'));
    await asA(request(app).post('/api/time/countdown').send({seconds: 90}));
    // Clock ticks (every second) and a heartbeat (every 2 s) arrive in the meantime
    await waitFor(() => clientNone.events.some((e) => e.event === 'heartbeat') && clientA.events.some((e) => e.event === 'callsheet_state_update'), 3000);

    const textA = clientA.events.map((e) => e.payload).join('\n');
    const textB = clientB.events.map((e) => e.payload).join('\n');
    expect(clientB.events.some((e) => e.event === 'active_event_update' && e.payload.includes(b.eventIds[1]))).toBe(true);
    expect(clientA.events.some((e) => e.event === 'time_state_update' && e.payload.includes('"initialDuration":90'))).toBe(true);
    for (const id of b.eventIds) expect(textA).not.toContain(id);
    expect(textA).not.toContain('LiveB');
    for (const id of a.eventIds) expect(textB).not.toContain(id);
    expect(textB).not.toContain('LiveA');
    expect(textB).not.toContain('"initialDuration":90');
    for (const {event, payload} of clientA.events.filter((e) => e.event === 'callsheet_state_update')) {
      expect(JSON.parse(payload)[0].productionId, event).toBe(a.productionId);
    }
    // Without an organization in the handshake: only the global events
    expect(clientNone.events.map((e) => e.event).filter((e) => !GLOBAL_EVENTS.has(e))).toEqual([]);
  });

  it('keeps the production clock (time sync) per organization', async () => {
    expect(await runWithOrganization(orgA, async () => timeSyncService.getState())).toMatchObject({mode: 'counting_down', initialDuration: 90});
    expect(await runWithOrganization(orgB, async () => timeSyncService.getState())).toMatchObject({mode: 'stopped'});
  });

  it('sends a new client the live state of its own organization', async () => {
    const late = await connectClient(await socketServerUrl(), {organization: LB});
    try {
      await waitFor(() => late.events.some((e) => e.event === 'active_event_update'));
      expect(late.events.find((e) => e.event === 'callsheet_state_update')?.payload).toContain(`"productionId":${b.productionId}`);
      expect(late.events.find((e) => e.event === 'active_event_update')?.payload).toContain(b.eventIds[1]);
      expect(late.events.map((e) => e.payload).join('\n')).not.toContain('LiveA');
    } finally {
      late.socket.close();
    }
  });

  it('stops A without touching B', async () => {
    expect((await asA(request(app).post(`/api/show/stop/${a.productionId}`))).status).toBe(200);
    expect(await stateOf(orgA)).toMatchObject({productionId: null, activeEventId: null, isClockRunning: false});
    expect(await stateOf(orgB)).toMatchObject({productionId: b.productionId, activeEventId: b.eventIds[1], isClockRunning: true});
    expect(await statuses(orgB, b.productionId)).toEqual(['COMPLETED', 'ACTIVE', 'WAITING']);
  });

  it('activates and imports only within the organization', async () => {
    const other = await createProductionScenario(prisma, {organizationId: orgA, items: [{title: 'LiveA ander'}]});
    try {
      expect((await asA(request(app).post(`/api/production/${other.productionId}/activate`))).status).toBe(200);
      const isActive = (organizationId: number, id: number) => runWithOrganization(organizationId, async () =>
        (await prisma.production.findUnique({where: {id}}))?.isActive);
      expect(await isActive(orgA, a.productionId)).toBe(false);
      expect(await isActive(orgB, b.productionId)).toBe(true);

      // An imported active production deactivates the others of the organization only
      const exported = await asA(request(app).get(`/api/production/${other.productionId}/export`));
      expect(exported.status).toBe(200);
      const imported = await asA(request(app).post('/api/production/import').send(exported.body));
      expect(imported.status, imported.text).toBeLessThan(300);
      expect(await isActive(orgB, b.productionId)).toBe(true);
      expect((await stateOf(orgB)).productionId).toBe(b.productionId);
    } finally {
      await runWithOrganization(orgA, () => prisma.production.deleteMany({where: {matchScheduleId: other.matchId}}));
      await other.cleanup();
    }
  });

  it('refuses a handshake with an unknown, inactive or malformed organization', async () => {
    const url = await socketServerUrl();
    const inactive = await prisma.organization.upsert({
      where: {slug: 'sec-live-off'}, update: {isActive: false}, create: {slug: 'sec-live-off', name: 'Uit', isActive: false},
    });
    try {
      for (const organization of ['no-such-org', 'sec-live-off', '../sec-live-a', 42, {slug: LA}]) {
        await expect(connectClient(url, {organization}), JSON.stringify(organization)).rejects.toThrow('Onbekende of inactieve organisatie');
      }
    } finally {
      await prisma.organization.delete({where: {id: inactive.id}});
    }
  });
});

describe.runIf(runDb)('background services per organization (integration)', () => {
  const PA = 'sec-push-a';
  const PB = 'sec-push-b';
  const servers: Array<Awaited<ReturnType<typeof recordingServer>>> = [];
  let orgA: number;
  let orgB: number;
  let a: ProductionScenario;
  let b: ProductionScenario;
  let vmixA: Awaited<ReturnType<typeof recordingServer>>;
  let vmixB: Awaited<ReturnType<typeof recordingServer>>;
  let boardA: Awaited<ReturnType<typeof recordingServer>>;
  let boardB: Awaited<ReturnType<typeof recordingServer>>;

  async function configure(organizationId: number, vmixUrl: string, boardUrl: string, input: string) {
    await runWithOrganization(organizationId, async () => {
      await setSetting('vmixInstances', {instances: [{id: 'pc', name: 'PC', url: vmixUrl}], targets: {}});
      await setSetting('vmixCallsheetPush', {enabled: true, input, positions: [], current: {titleField: 'Titel.Text'}});
      await setSetting('scoreboardUrl', boardUrl);
    });
  }

  beforeAll(async () => {
    orgA = await ensureOrganization(prisma, PA, 'Sec Push A');
    orgB = await ensureOrganization(prisma, PB, 'Sec Push B');
    a = await createProductionScenario(prisma, {organizationId: orgA, active: true, items: [{title: 'PushAlpha item', status: 'ACTIVE'}]});
    b = await createProductionScenario(prisma, {organizationId: orgB, active: true, items: [{title: 'PushBeta item', status: 'ACTIVE'}]});
    vmixA = await recordingServer({status: 200, body: ''});
    vmixB = await recordingServer({status: 200, body: ''});
    boardA = await recordingServer({status: 200, body: '["12","34"]'});
    boardB = await recordingServer({status: 200, body: '["05","06"]'});
    servers.push(vmixA, vmixB, boardA, boardB);
    await configure(orgA, vmixA.url, boardA.url, 'InputAlpha');
    await configure(orgB, vmixB.url, boardB.url, 'InputBeta');
    // The loops follow the live state in memory: both shows run (as after a restart with an active item)
    for (const organizationId of [orgA, orgB]) await runWithOrganization(organizationId, liveState.restoreLiveState);
  });

  afterAll(async () => {
    for (const organizationId of [orgA, orgB]) if (organizationId) liveState.discardLiveState(organizationId);
    await Promise.all(servers.map((s) => s.close()));
    await a?.cleanup();
    await b?.cleanup();
    await prisma.organization.deleteMany({where: {slug: {in: [PA, PB]}}});
  });

  it('pushes each organization\'s callsheet to its own vMix only', async () => {
    await pushForActiveOrganizations();
    const sentA = vmixA.urls.map(decodeQuery).join('\n');
    const sentB = vmixB.urls.map(decodeQuery).join('\n');
    expect(sentA).toContain('PushAlpha item');
    expect(sentA).toContain('Input=InputAlpha');
    expect(sentA).not.toContain('PushBeta');
    expect(sentA).not.toContain('InputBeta');
    expect(sentB).toContain('PushBeta item');
    expect(sentB).not.toContain('PushAlpha');
    expect(sentB).not.toContain('InputAlpha');
  });

  it('remembers what was sent per organization (a change in A doesn\'t make B skip or resend)', async () => {
    vmixA.urls.length = 0;
    vmixB.urls.length = 0;
    await runWithOrganization(orgA, () => prisma.productionEvent.update({where: {id: a.eventIds[0]}, data: {title: 'PushAlpha renamed'}}));
    await pushForActiveOrganizations();
    expect(vmixA.urls.map(decodeQuery).join('\n')).toContain('PushAlpha renamed');
    expect(vmixB.urls.map(decodeQuery).join('\n')).not.toContain('PushBeta item');
  });

  it('syncs each organization\'s venue clock from its own scoreboard', async () => {
    await syncVenueClocks();
    expect((await runWithOrganization(orgA, async () => liveState.liveStateSnapshot())).clocks.scoreboardTime).toBe(12 * 60 + 34);
    expect((await runWithOrganization(orgB, async () => liveState.liveStateSnapshot())).clocks.scoreboardTime).toBe(5 * 60 + 6);
    expect(boardA.urls).toContain('/v1/time-as-array');
    expect(boardB.urls).toContain('/v1/time-as-array');
  });

  it('doesn\'t let a dripping scoreboard of one organization stall another\'s clock', async () => {
    const drip = await scoreboardServer('drip');
    const counting = await scoreboardServer('count');
    const clockOf = async (organizationId: number) =>
      (await runWithOrganization(organizationId, async () => liveState.liveStateSnapshot())).clocks.scoreboardTime;
    await runWithOrganization(orgA, () => setSetting('scoreboardUrl', drip.url));
    await runWithOrganization(orgB, () => setSetting('scoreboardUrl', counting.url));
    try {
      // One round ends at the wall-clock deadline, although the scoreboard keeps sending a byte now and then
      const started = Date.now();
      await syncVenueClocks();
      expect(Date.now() - started).toBeLessThan(1500);
      expect(await clockOf(orgB)).toBe(1);

      // The timer: B's clock moves on every second while A's scoreboard drips
      venueClockSyncService.start();
      try {
        await waitFor(() => counting.requests() >= 4, 4500);
      } finally {
        venueClockSyncService.stop();
      }
      expect(counting.requests()).toBeGreaterThanOrEqual(4);
      expect(await clockOf(orgB)).toBeGreaterThanOrEqual(3);
      expect(await clockOf(orgA)).toBe(12 * 60 + 34);
    } finally {
      await runWithOrganization(orgA, () => setSetting('scoreboardUrl', boardA.url));
      await runWithOrganization(orgB, () => setSetting('scoreboardUrl', boardB.url));
      await Promise.all([drip.close(), counting.close()]);
    }
  });
});

/**
 * A scoreboard answering time-as-array. `count`: 00:01, 00:02, … per request. `drip`: sends one byte
 * every 100 ms for 5 s and never a valid answer (each byte resets an idle timeout).
 */
async function scoreboardServer(mode: 'count' | 'drip') {
  let requests = 0;
  const timers = new Set<NodeJS.Timeout>();
  const server = http.createServer((_req, res) => {
    requests++;
    res.writeHead(200, {'content-type': 'application/json'});
    if (mode === 'count') return void res.end(JSON.stringify(['00', String(requests).padStart(2, '0')]));
    res.write('[');
    let sent = 0;
    const timer = setInterval(() => {
      if (++sent > 50 || res.destroyed) {
        clearInterval(timer);
        timers.delete(timer);
        return void res.end();
      }
      res.write(' ');
    }, 100);
    timers.add(timer);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    requests: () => requests,
    close: () => new Promise<void>((resolve) => {
      timers.forEach(clearInterval);
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

describe.runIf(runDb)('API keys on the feed routes (integration)', () => {
  const KA = 'sec-key-a';
  const KB = 'sec-key-b';
  let orgA: number;
  let orgB: number;
  let keyA: string;
  let keyAId: number;
  let keyB: string;

  const feed = (path: string) => withoutOrganization(request(app).get(path));
  const createKey = async (slug: string, name: string) => {
    const res = await request(app).post('/api/organization/api-keys').set('X-Organization', slug).send({name});
    expect(res.status).toBe(201);
    return res.body as {id: number; key: string; prefix: string; name: string};
  };

  beforeAll(async () => {
    orgA = await ensureOrganization(prisma, KA, 'Sec Key A');
    orgB = await ensureOrganization(prisma, KB, 'Sec Key B');
    await runWithOrganization(orgA, () => prisma.sponsor.create({data: {name: 'KeyAlpha Sponsor', type: 'premium', websiteUrl: 'https://a.example'}}));
    await runWithOrganization(orgB, () => prisma.sponsor.create({data: {name: 'KeyBeta Sponsor', type: 'premium', websiteUrl: 'https://b.example'}}));
    const created = await createKey(KA, 'vMix stream-pc');
    keyA = created.key;
    keyAId = created.id;
    keyB = (await createKey(KB, 'vMix B')).key;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [KA, KB]}}});
  });

  it('creates a key once: sk_ + 32 random bytes, stored only as its SHA-256 hash', async () => {
    expect(keyA).toMatch(/^sk_[A-Za-z0-9_-]{43}$/);
    const row = await runWithOrganization(orgA, () => prisma.organizationApiKey.findUniqueOrThrow({where: {id: keyAId}}));
    expect(row.keyHash).toBe(hashApiKey(keyA));
    expect(JSON.stringify(row)).not.toContain(keyA);
    expect(keyA.startsWith(row.prefix)).toBe(true);
    expect(row.prefix.length).toBeLessThan(12);
  });

  it('lists keys without the key or its hash, only for the own organization', async () => {
    const list = await request(app).get('/api/organization/api-keys').set('X-Organization', KA);
    expect(list.status).toBe(200);
    expect(list.body).toEqual([expect.objectContaining({id: keyAId, name: 'vMix stream-pc', prefix: keyA.slice(0, 9), lastUsedAt: null, revokedAt: null})]);
    expect(list.text).not.toContain(keyA);
    expect(list.text).not.toContain(hashApiKey(keyA));
    expect(list.body[0]).not.toHaveProperty('keyHash');
    expect(list.body[0]).not.toHaveProperty('key');

    const asB = await request(app).get('/api/organization/api-keys').set('X-Organization', KB);
    expect(asB.body.map((k: {name: string}) => k.name)).toEqual(['vMix B']);
    expect((await request(app).delete(`/api/organization/api-keys/${keyAId}`).set('X-Organization', KB)).status).toBe(404);
  });

  it('refuses a key without a name', async () => {
    expect((await request(app).post('/api/organization/api-keys').send({name: '  '})).status).toBe(400);
    expect((await request(app).post('/api/organization/api-keys').send({name: 'x', keyHash: 'abc'})).status).toBe(400);
  });

  it('opens the feeds of the key\'s organization, by ?key= or X-Api-Key', async () => {
    for (const res of [
      await feed(`/api/vmix/sponsor-names?key=${keyA}`),
      await feed('/api/vmix/sponsor-names').set('X-Api-Key', keyA),
      // The key decides, not X-Organization
      await request(app).get(`/api/vmix/sponsor-names?key=${keyA}`).set('X-Organization', KB),
    ]) {
      expect(res.status).toBe(200);
      expect(res.text).toContain('KeyAlpha Sponsor');
      expect(res.text).not.toContain('KeyBeta');
    }
    const asB = await feed(`/api/vmix/sponsor-names?key=${keyB}`).set('X-Organization', KA);
    expect(asB.text).toContain('KeyBeta Sponsor');
    expect(asB.text).not.toContain('KeyAlpha');
    // The other feeds accept it too (here without an active production or scoreboard: no 401)
    for (const path of ['/api/vmix/sponsor-carrousel', '/api/vmix/active-production/match', '/api/vmix/callsheet/timing', '/api/vmix/production/active/titles']) {
      expect((await feed(`${path}?key=${keyA}`)).status, path).not.toBe(401);
    }
  });

  it('still lets the browser use X-Organization on the feeds', async () => {
    const res = await request(app).get('/api/vmix/sponsor-names').set('X-Organization', KA);
    expect(res.status).toBe(200);
    expect(res.text).toContain('KeyAlpha Sponsor');
  });

  it('answers 401 "API-sleutel ontbreekt" on a feed without key or organization', async () => {
    for (const path of ['/api/vmix/sponsor-names', '/api/vmix/active-production/staff', '/api/scoreboard', '/api/scoreboard/clock', '/api/vmix/production/1/titles']) {
      const res = await feed(path);
      expect(res.status, path).toBe(401);
      expect(res.body, path).toEqual({error: 'API-sleutel ontbreekt', code: 'API_KEY_MISSING'});
    }
  });

  it('answers 401 for an invalid, malformed or deleted organization\'s key', async () => {
    const gone = await ensureOrganization(prisma, 'sec-key-gone', 'Weg');
    const goneKey = (await createKey('sec-key-gone', 'weg')).key;
    await prisma.organization.update({where: {id: gone}, data: {isActive: false}});
    const inactiveRes = await feed(`/api/vmix/sponsor-names?key=${goneKey}`);
    await prisma.organization.delete({where: {id: gone}});
    expect(inactiveRes.status).toBe(401);

    for (const path of [
      `/api/vmix/sponsor-names?key=${goneKey}`,
      '/api/vmix/sponsor-names?key=sk_nonsense',
      `/api/vmix/sponsor-names?key=${keyA.slice(0, -1)}`,
      '/api/vmix/sponsor-names?key=',
      `/api/vmix/sponsor-names?key[]=${keyA}`,
      // qs (req.query) reads these as `key` too; the key is read from the URL only, as one plain key=
      `/api/vmix/sponsor-names?[key]=${keyA}`,
      `/api/vmix/sponsor-names?%5Bkey%5D=${keyA}`,
      `/api/vmix/sponsor-names?[key][x]=${keyA}`,
      `/api/vmix/sponsor-names?key=${keyA}&[key]=${keyA}`,
      `/api/vmix/sponsor-names?key=${keyA}&key=${keyA}`,
      `/api/vmix/sponsor-names?key=${'x'.repeat(5000)}`,
    ]) {
      const res = await feed(path);
      expect(res.status, path.slice(0, 80)).toBe(401);
      expect(res.body).toEqual({error: 'Ongeldige API-sleutel', code: 'API_KEY_INVALID'});
    }
    // A wrong key isn't saved by a valid X-Organization
    expect((await request(app).get('/api/vmix/sponsor-names?key=sk_nonsense').set('X-Organization', KA)).status).toBe(401);
  });

  it('never opens a Beheer or LIVE route with a key', async () => {
    for (const path of ['/api/production', '/api/sponsors', '/api/settings/vmix-url', '/api/organization/api-keys', '/api/vmix/endpoints', '/api/backup/sponsors/export']) {
      for (const res of [await feed(`${path}?key=${keyA}`), await feed(path).set('X-Api-Key', keyA)]) {
        expect(res.status, path).toBe(401);
        expect(res.body, path).toEqual({error: 'Kies een organisatie', code: 'ORGANIZATION_REQUIRED'});
      }
    }
    const post = await withoutOrganization(request(app).post(`/api/vmix/set-timer?key=${keyA}`)).send({seconds: 10});
    expect(post.status).toBe(401);
    const create = await withoutOrganization(request(app).post('/api/organization/api-keys')).set('X-Api-Key', keyA).send({name: 'via key'});
    expect(create.status).toBe(401);
  });

  it('writes lastUsedAt, but not on every request', async () => {
    const lastUsed = () => runWithOrganization(orgA, async () => (await prisma.organizationApiKey.findUniqueOrThrow({where: {id: keyAId}})).lastUsedAt);
    await runWithOrganization(orgA, () => prisma.organizationApiKey.update({where: {id: keyAId}, data: {lastUsedAt: null}}));
    clearOrganizationLookupCache(); // changed behind the API's back: forget the cached key
    await feed(`/api/vmix/sponsor-names?key=${keyA}`);
    await waitFor(async () => (await lastUsed()) !== null);
    const first = await lastUsed();
    expect(first).not.toBeNull();
    await feed(`/api/vmix/sponsor-names?key=${keyA}`);
    await new Promise((r) => setTimeout(r, 200));
    expect((await lastUsed())?.getTime()).toBe(first?.getTime());
    expect(LAST_USED_WRITE_INTERVAL_MS).toBeGreaterThanOrEqual(30_000);
  });

  it('keeps the key out of the logs', async () => {
    const logged: string[] = [];
    const capture = (...args: unknown[]) => void logged.push(JSON.stringify(args));
    const spies = (['info', 'warn', 'error', 'debug'] as const).map((level) => vi.spyOn(logger, level).mockImplementation(capture as never));
    try {
      await feed(`/api/vmix/sponsor-names?seed=1&key=${keyA}`);
      await feed(`/api/vmix/sponsor-names?k%65y=${keyA}`);
      await feed(`/api/vmix/sponsor-names?seed=2&[key]=${keyA}`);
      await feed(`/api/vmix/sponsor-names?%5Bkey%5D=${keyA}`);
      await feed(`/api/vmix/sponsor-names?[key][x]=${keyA}`);
      await feed(`/api/production?[key]=${keyA}`);
      await feed(`/api/production?key=${keyA}`);
      await feed(`/api/vmix/production/abc/titles?key=${keyA}`);
      await feed('/api/vmix/sponsor-names').set('X-Api-Key', keyA);
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
    const text = logged.join('\n');
    expect(text).toContain('sponsor-names');
    expect(text).toContain('seed');
    expect(text).not.toContain(keyA);
    expect(text).not.toContain(keyA.slice(3));
  });

  it('stops a revoked key right away', async () => {
    expect((await feed(`/api/vmix/sponsor-names?key=${keyA}`)).status).toBe(200);
    const revoked = await request(app).delete(`/api/organization/api-keys/${keyAId}`).set('X-Organization', KA);
    expect(revoked.status).toBe(200);
    expect(revoked.body.revokedAt).toBeTruthy();
    const res = await feed(`/api/vmix/sponsor-names?key=${keyA}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({error: 'Ongeldige API-sleutel', code: 'API_KEY_INVALID'});
    const list = await request(app).get('/api/organization/api-keys').set('X-Organization', KA);
    expect(list.body[0]).toMatchObject({id: keyAId, revokedAt: expect.any(String)});
  });
});

// ---------------------------------------------------------------------------------------------------
// Phase 2 review: cross-site writes, switching an organization off
// ---------------------------------------------------------------------------------------------------

describe('cross-site writes (CSRF)', () => {
  const EVIL = 'https://evil.example';
  const GLOBAL_WRITES = ['/api/organizations', '/api/seasons', '/api/clubs', '/api/players'];

  it.each(GLOBAL_WRITES)('refuses a cross-site form or multipart POST to %s with 403', async (route) => {
    const form = await withoutOrganization(request(app).post(route)).set('Origin', EVIL).type('form').send('name=Evil&slug=evil');
    expect(form.status).toBe(403);
    expect(form.body).toEqual({error: 'Verzoek van een andere website geweigerd', code: 'CROSS_SITE_REFUSED'});
    const multipart = await withoutOrganization(request(app).post(route)).set('Origin', EVIL)
      .field('name', 'Evil').attach('file', PNG, {filename: 'x.png', contentType: 'image/png'});
    expect(multipart.status).toBe(403);
    // Fetch metadata without an Origin, and an opaque origin (sandboxed iframe, file://)
    expect((await withoutOrganization(request(app).post(route)).set('Sec-Fetch-Site', 'cross-site').type('form').send('name=Evil')).status).toBe(403);
    expect((await withoutOrganization(request(app).post(route)).set('Origin', 'null').type('form').send('name=Evil')).status).toBe(403);
  });

  it('refuses PUT, PATCH and DELETE from another site too, also on tenant routes and on another port', async () => {
    expect((await withoutOrganization(request(app).put('/api/organizations/1')).set('Origin', EVIL).send({isActive: false})).status).toBe(403);
    expect((await withoutOrganization(request(app).delete('/api/seasons/1')).set('Origin', EVIL)).status).toBe(403);
    // The indoor competition start date of a season (global data)
    const seasonPut = await withoutOrganization(request(app).put('/api/seasons/1')).set('Origin', EVIL).send({indoorStartDate: '07-11-2026'});
    expect(seasonPut.status).toBe(403);
    expect(seasonPut.body.code).toBe('CROSS_SITE_REFUSED');
    expect((await withoutOrganization(request(app).put('/api/seasons/1')).set('Sec-Fetch-Site', 'cross-site').send({indoorStartDate: null})).status).toBe(403);
    expect((await request(app).patch('/api/sponsors/1').set('Origin', EVIL).send({})).status).toBe(403);
    expect((await request(app).post('/api/sponsors').set('Host', 'localhost:3333').set('Origin', 'http://localhost:9999').send({})).status).toBe(403);
    // Same site (another port) is not same-origin
    expect((await request(app).post('/api/sponsors').set('Host', 'localhost:3333').set('Origin', 'http://localhost:9999')
      .set('Sec-Fetch-Site', 'same-site').send({})).status).toBe(403);
  });

  it('refuses a cross-site feed write without an API key', async () => {
    const res = await request(app).post('/api/vmix/production/trigger-manual').set('Origin', EVIL).send({eventId: 'x'});
    expect(res.status).toBe(403);
  });
});

describe.runIf(runDb)('cross-site writes (CSRF, integration)', () => {
  const SAME = 'sec-csrf-same';
  const VITE = 'sec-csrf-vite';
  const NONE = 'sec-csrf-none';
  const KEYED = 'sec-csrf-key';

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [SAME, VITE, NONE, KEYED, 'evil']}}});
  });

  it('lets reads from another site through (no CORS, so the page can\'t read the answer)', async () => {
    const res = await withoutOrganization(request(app).get('/api/organizations')).set('Origin', 'https://evil.example').set('Sec-Fetch-Site', 'cross-site');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('lets same-origin writes through: nginx, the Vite proxy (also multipart), and clients without an Origin', async () => {
    const nginx = await withoutOrganization(request(app).post('/api/organizations'))
      .set('Host', 'streamz.local').set('Origin', 'http://streamz.local').set('Sec-Fetch-Site', 'same-origin')
      .send({name: 'CSRF same', slug: SAME});
    expect(nginx.status, nginx.text).toBe(201);

    // The Vite dev proxy: Host is the API's port, X-Forwarded-Host the dev server's (xfwd)
    const viaVite = (r: request.Test) => r.set('Host', 'localhost:3333').set('X-Forwarded-Host', 'localhost:4200')
      .set('Origin', 'http://localhost:4200').set('Sec-Fetch-Site', 'same-origin');
    const vite = await viaVite(withoutOrganization(request(app).post('/api/organizations'))).type('form').send(`name=CSRF+vite&slug=${VITE}`);
    expect(vite.status, vite.text).toBe(201);
    const logo = await viaVite(withoutOrganization(request(app).post(`/api/organizations/${vite.body.id}/logo`)))
      .attach('file', PNG, {filename: 'logo.png', contentType: 'image/png'});
    expect(logo.status, logo.text).toBe(200);

    // vMix, curl, Node: no Origin
    const none = await withoutOrganization(request(app).post('/api/organizations')).send({name: 'CSRF none', slug: NONE});
    expect(none.status, none.text).toBe(201);
    expect(await prisma.organization.count({where: {slug: 'evil'}})).toBe(0);
  });

  it('lets a feed write with an API key through from another site (an HTML overlay with a key)', async () => {
    await ensureOrganization(prisma, KEYED, 'CSRF key');
    const key = (await request(app).post('/api/organization/api-keys').set('X-Organization', KEYED).send({name: 'overlay'})).body.key as string;
    const res = await withoutOrganization(request(app).post(`/api/vmix/production/trigger-manual?key=${key}`))
      .set('Origin', 'https://overlay.example').set('Sec-Fetch-Site', 'cross-site').send({});
    // Past the CSRF guard and the key check: the route itself answers (no eventId)
    expect(res.status).toBe(400);
    // A wrong key opens nothing
    const wrong = await withoutOrganization(request(app).post('/api/vmix/production/trigger-manual?key=sk_wrong')).set('Origin', 'https://overlay.example').send({});
    expect(wrong.status).toBe(401);
  });
});

describe.runIf(runDb)('switching an organization off (integration)', () => {
  const OFF = 'sec-switch-off';
  let organizationId: number;
  let show: ProductionScenario;

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, OFF, 'Sec Switch Off');
    show = await createProductionScenario(prisma, {organizationId, active: true, items: [{title: 'SwitchOff opening'}, {title: 'SwitchOff einde'}]});
  });

  afterAll(async () => {
    if (show) {
      await runWithOrganization(organizationId, () => liveState.stopProduction(liveState.getActiveProductionId() ?? show.productionId));
      await runWithOrganization(organizationId, () => prisma.production.deleteMany({where: {matchScheduleId: show.matchId}}));
      await show.cleanup();
    }
    await prisma.organization.deleteMany({where: {slug: OFF}});
  });

  it('stops its live show, timers, background services and sockets, and resumes when switched on', async () => {
    const asOff = (r: request.Test) => r.set('X-Organization', OFF);
    expect((await asOff(request(app).post(`/api/show/start/${show.productionId}`))).status).toBe(200);
    expect((await asOff(request(app).post('/api/time/countdown')).send({seconds: 60})).status).toBe(200);
    await runWithOrganization(organizationId, () => setSetting('vmixCallsheetPush', {enabled: false}));
    await pushForActiveOrganizations();
    const client = await connectClient(await socketServerUrl(), {organization: OFF});
    const state = await runWithOrganization(organizationId, async () => liveState.getCurrentState());
    expect(state.clockInterval).not.toBeNull();
    expect(liveState.hasLiveState(organizationId)).toBe(true);
    expect(timeSyncService.hasState(organizationId)).toBe(true);
    expect(hasPushMemory(organizationId)).toBe(true);
    expect(liveState.liveOrganizationIds()).toContain(organizationId);

    const disconnected = new Promise<string>((resolve) => client.socket.once('disconnect', resolve));
    const off = await request(app).put(`/api/organizations/${organizationId}`).send({isActive: false});
    expect(off.status).toBe(200);
    expect(await disconnected).toBe('io server disconnect');

    expect(state.clockInterval).toBeNull();
    expect(state.autoAdvanceTimer).toBeNull();
    const ticks = state.clocks.productionTime;
    await new Promise((r) => setTimeout(r, 1200));
    expect(state.clocks.productionTime).toBe(ticks);
    expect(liveState.hasLiveState(organizationId)).toBe(false);
    expect(timeSyncService.hasState(organizationId)).toBe(false);
    expect(hasPushMemory(organizationId)).toBe(false);
    expect(liveState.liveOrganizationIds()).not.toContain(organizationId);
    await expect(connectClient(await socketServerUrl(), {organization: OFF})).rejects.toThrow('Onbekende of inactieve organisatie');
    // The database keeps the production: switching it on again picks it up
    expect((await runWithOrganization(organizationId, () => prisma.production.findUnique({where: {id: show.productionId}})))?.isActive).toBe(true);

    expect((await request(app).put(`/api/organizations/${organizationId}`).send({isActive: true})).status).toBe(200);
    expect(await runWithOrganization(organizationId, async () => liveState.liveStateSnapshot()))
      .toMatchObject({productionId: show.productionId, activeEventId: show.eventIds[0], isClockRunning: true});
    expect(liveState.liveOrganizationIds()).toContain(organizationId);
  });
});

// ---------------------------------------------------------------------------------------------------
// PR #12 review: stable error codes, cached lookups, background loops on the live state
// ---------------------------------------------------------------------------------------------------

describe('stable error codes on refusals', () => {
  it('sends a code next to the message, so clients never match on the text', async () => {
    expect((await withoutOrganization(request(app).get('/api/sponsors'))).body).toEqual({error: 'Kies een organisatie', code: 'ORGANIZATION_REQUIRED'});
    expect((await withoutOrganization(request(app).get('/api/clubs/1/teams'))).body).toMatchObject({code: 'ORGANIZATION_REQUIRED'});
    expect((await withoutOrganization(request(app).get('/api/vmix/sponsor-names'))).body).toEqual({error: 'API-sleutel ontbreekt', code: 'API_KEY_MISSING'});
    const csrf = await withoutOrganization(request(app).post('/api/organizations')).set('Origin', 'https://evil.example').send({});
    expect(csrf.status).toBe(403);
    expect(csrf.body).toEqual({error: 'Verzoek van een andere website geweigerd', code: 'CROSS_SITE_REFUSED'});
  });

  it('keeps the two 403s apart: only an unknown organization is ORGANIZATION_UNKNOWN', async () => {
    const unknown = await request(app).get('/api/sponsors').set('X-Organization', '../x');
    const crossSite = await request(app).post('/api/sponsors').set('Origin', 'https://evil.example').send({});
    expect([unknown.status, crossSite.status]).toEqual([403, 403]);
    expect(unknown.body.code).toBe('ORGANIZATION_UNKNOWN');
    expect(crossSite.body.code).toBe('CROSS_SITE_REFUSED');
  });
});

describe.runIf(runDb)('stable error codes on refusals (integration)', () => {
  it('sends API_KEY_INVALID for a wrong key and ORGANIZATION_UNKNOWN for an unknown organization', async () => {
    expect((await withoutOrganization(request(app).get('/api/vmix/sponsor-names?key=sk_nonsense'))).body)
      .toEqual({error: 'Ongeldige API-sleutel', code: 'API_KEY_INVALID'});
    expect((await request(app).get('/api/sponsors').set('X-Organization', 'no-such-org')).body)
      .toEqual({error: 'Onbekende of inactieve organisatie', code: 'ORGANIZATION_UNKNOWN'});
  });

  it('sends the code with a refused socket handshake (connect_error data.code)', async () => {
    const error = await connectClient(await socketServerUrl(), {organization: 'no-such-org'}).catch((err) => err);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Onbekende of inactieve organisatie');
    expect(error.data).toEqual({code: 'ORGANIZATION_UNKNOWN'});
  });
});

describe.runIf(runDb)('organization and API key lookups are cached briefly (integration)', () => {
  const CA = 'sec-cache-a';
  const RENAMED = 'sec-cache-renamed';
  const LATE = 'sec-cache-late';
  let organizationId: number;
  let key: string;

  const asCached = (slug = CA) => request(app).get('/api/sponsors').set('X-Organization', slug);
  const viaKey = (k = key) => withoutOrganization(request(app).get(`/api/vmix/sponsor-names?key=${k}`));
  const createKey = async (name: string) =>
    (await request(app).post('/api/organization/api-keys').set('X-Organization', CA).send({name})).body as {id: number; key: string};

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, CA, 'Sec Cache A');
    key = (await createKey('cache')).key;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [CA, RENAMED, LATE]}}});
    clearOrganizationLookupCache();
  });

  it('answers a repeated slug or key from memory for a few seconds', async () => {
    expect((await asCached()).status).toBe(200);
    expect((await viaKey()).status).toBe(200);
    const queries = await recordQueries(async () => {
      expect((await asCached()).status).toBe(200);
      expect((await viaKey()).status).toBe(200);
    });
    // Lookups only: the first key request writes lastUsedAt in the background, which may land in this window
    expect(queries.filter((q) => /^\s*SELECT/i.test(q) && /"Organization"|"OrganizationApiKey"/.test(q))).toEqual([]);

    // Switched off behind the API's back (not through PUT): the cache answers until it expires
    await prisma.organization.update({where: {id: organizationId}, data: {isActive: false}});
    try {
      expect((await asCached()).status).toBe(200);
      const later = Date.now() + ORGANIZATION_LOOKUP_TTL_MS + 1;
      const clock = vi.spyOn(Date, 'now').mockReturnValue(later);
      try {
        expect((await asCached()).body.code).toBe('ORGANIZATION_UNKNOWN');
        expect((await viaKey()).body.code).toBe('API_KEY_INVALID');
      } finally {
        clock.mockRestore();
      }
    } finally {
      await prisma.organization.update({where: {id: organizationId}, data: {isActive: true}});
      clearOrganizationLookupCache();
    }
    expect(ORGANIZATION_LOOKUP_TTL_MS).toBeLessThanOrEqual(5_000);
  });

  it('stops a deactivated organization at once: its slug, its keys and its sockets', async () => {
    expect((await asCached()).status).toBe(200);
    expect((await viaKey()).status).toBe(200);
    (await connectClient(await socketServerUrl(), {organization: CA})).socket.close();

    expect((await request(app).put(`/api/organizations/${organizationId}`).send({isActive: false})).status).toBe(200);
    try {
      const refused = await asCached();
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe('ORGANIZATION_UNKNOWN');
      const keyRefused = await viaKey();
      expect(keyRefused.status).toBe(401);
      expect(keyRefused.body.code).toBe('API_KEY_INVALID');
      await expect(connectClient(await socketServerUrl(), {organization: CA})).rejects.toThrow('Onbekende of inactieve organisatie');
    } finally {
      expect((await request(app).put(`/api/organizations/${organizationId}`).send({isActive: true})).status).toBe(200);
    }
    // And back on at once too
    expect((await asCached()).status).toBe(200);
    expect((await viaKey()).status).toBe(200);
  });

  it('follows a slug rename at once: the old slug stops, the new one works', async () => {
    expect((await asCached()).status).toBe(200);
    expect((await request(app).put(`/api/organizations/${organizationId}`).send({slug: RENAMED})).status).toBe(200);
    try {
      expect((await asCached()).body.code).toBe('ORGANIZATION_UNKNOWN');
      expect((await asCached(RENAMED)).status).toBe(200);
    } finally {
      expect((await request(app).put(`/api/organizations/${organizationId}`).send({slug: CA})).status).toBe(200);
    }
    expect((await asCached(RENAMED)).body.code).toBe('ORGANIZATION_UNKNOWN');
    expect((await asCached()).status).toBe(200);
  });

  it('stops a revoked key at once, also right after it was used', async () => {
    const created = await createKey('revoke me');
    expect((await viaKey(created.key)).status).toBe(200);
    expect((await viaKey(created.key)).status).toBe(200);
    expect((await request(app).delete(`/api/organization/api-keys/${created.id}`).set('X-Organization', CA)).status).toBe(200);
    const res = await viaKey(created.key);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('API_KEY_INVALID');
    // The other key of the organization keeps working
    expect((await viaKey()).status).toBe(200);
  });

  it('does not remember an unknown slug: an organization created right after works at once', async () => {
    expect((await asCached(LATE)).body.code).toBe('ORGANIZATION_UNKNOWN');
    await ensureOrganization(prisma, LATE, 'Sec Cache Late');
    expect((await asCached(LATE)).status).toBe(200);
  });
});

describe.runIf(runDb)('background loops follow the live state in memory (integration)', () => {
  const IDLE = 'sec-loop-idle';
  let organizationId: number;
  let show: ProductionScenario;
  let vmix: Awaited<ReturnType<typeof recordingServer>>;
  let board: Awaited<ReturnType<typeof recordingServer>>;

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, IDLE, 'Sec Loop Idle');
    // Active in the database, but no show runs (not started, no live state)
    show = await createProductionScenario(prisma, {organizationId, active: true, items: [{title: 'IdleLoop item', status: 'ACTIVE'}]});
    vmix = await recordingServer({status: 200, body: ''});
    board = await recordingServer({status: 200, body: '["01","02"]'});
    await runWithOrganization(organizationId, async () => {
      await setSetting('vmixInstances', {instances: [{id: 'pc', name: 'PC', url: vmix.url}], targets: {}});
      await setSetting('vmixCallsheetPush', {enabled: true, input: 'IdleInput', positions: [], current: {titleField: 'Titel.Text'}});
      await setSetting('scoreboardUrl', board.url);
    });
  });

  afterAll(async () => {
    liveState.discardLiveState(organizationId);
    await Promise.all([vmix?.close(), board?.close()]);
    await show?.cleanup();
    await prisma.organization.deleteMany({where: {slug: IDLE}});
  });

  it('asks the database nothing per round while no show runs', async () => {
    expect(liveState.liveOrganizationIds()).not.toContain(organizationId);
    const queries = await recordQueries(async () => {
      await pushForActiveOrganizations();
      await syncVenueClocks();
    });
    expect(queries).toEqual([]);
    expect(vmix.urls).toEqual([]);
    expect(board.urls).toEqual([]);
  });

  it('pushes and syncs once the show runs, and stops again when it stops', async () => {
    await runWithOrganization(organizationId, liveState.restoreLiveState);
    expect(liveState.liveOrganizationIds()).toContain(organizationId);
    await pushForActiveOrganizations();
    await syncVenueClocks();
    expect(vmix.urls.map(decodeQuery).join('\n')).toContain('IdleLoop item');
    expect(board.urls).toContain('/v1/time-as-array');

    await runWithOrganization(organizationId, () => liveState.stopProduction(show.productionId));
    expect(liveState.liveOrganizationIds()).not.toContain(organizationId);
    vmix.urls.length = 0;
    board.urls.length = 0;
    await pushForActiveOrganizations();
    await syncVenueClocks();
    expect([vmix.urls, board.urls]).toEqual([[], []]);
  });
});

describe.runIf(runDb)('background loops skip a restored show that has not started (integration)', () => {
  const WAITING = 'sec-loop-waiting';
  let organizationId: number;
  let show: ProductionScenario;

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, WAITING, 'Sec Loop Waiting');
    // Active in the database, all items still waiting: as after a restart before the show starts
    show = await createProductionScenario(prisma, {organizationId, active: true, items: [{title: 'WaitingLoop item'}]});
  });

  afterAll(async () => {
    liveState.discardLiveState(organizationId);
    await show?.cleanup();
    await prisma.organization.deleteMany({where: {slug: WAITING}});
  });

  it('keeps the organization out of the loops until an item is active', async () => {
    await runWithOrganization(organizationId, liveState.restoreLiveState);
    expect(await runWithOrganization(organizationId, async () => liveState.liveStateSnapshot()))
      .toMatchObject({productionId: show.productionId, activeEventId: null});
    expect(liveState.liveOrganizationIds()).not.toContain(organizationId);

    expect((await request(app).post(`/api/show/start/${show.productionId}`).set('X-Organization', WAITING)).status).toBe(200);
    expect(liveState.liveOrganizationIds()).toContain(organizationId);
    await runWithOrganization(organizationId, () => liveState.stopProduction(show.productionId));
  });
});
