import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import app from './main';
import {logger} from './utils/logger';
import {getAssetsRoot} from './services/config';
import {prisma as appPrisma} from './services/prisma';
import {MissingOrganizationContextError, runWithOrganization} from './services/organizationContext';
import {ensureOrganization, testDb as prisma, testOrganizationId, TEST_ORGANIZATION_SLUG, withoutOrganization} from '../test-helpers';
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

  it('stores an organization logo as organizations/<slug>.<ext>, whatever the file is called', async () => {
    const before = new Set(filesUnder(root()));
    const res = await request(app).post(`/api/organizations/${organizationId}/logo`).attach('file', PNG, {filename: '../../../evil.png', contentType: 'image/png'});
    expect(res.status, res.text).toBe(200);
    expect(res.body.logoUrl).toBe(`organizations/${TEST_ORGANIZATION_SLUG}.png`);
    const added = filesUnder(root()).filter((f) => !before.has(f));
    expect(added.every((f) => f.startsWith(path.join(root(), 'organizations') + path.sep))).toBe(true);
    expect(fs.existsSync(path.join(root(), 'organizations', `${TEST_ORGANIZATION_SLUG}.png`))).toBe(true);
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

  it('stores a sponsor logo in the organization\'s own directory, whatever the file is called', async () => {
    const res = await request(app).post(`/api/sponsors/${sponsorId}/logo`).attach('file', PNG, {filename: '../../../../etc/evil.png', contentType: 'image/png'});
    expect(res.status, res.text).toBe(200);
    expect(res.body.logoUrl).toBe(`${TEST_ORGANIZATION_SLUG}/sec-upload-sponsor.png`);
    expect(fs.existsSync(path.join(root(), 'sponsors', TEST_ORGANIZATION_SLUG, 'sec-upload-sponsor.png'))).toBe(true);
    expect(fs.existsSync(path.join(root(), 'etc', 'evil.png'))).toBe(false);
  });

  it('refuses non-images for a sponsor logo', async () => {
    const html = Buffer.from('<html></html>');
    expect((await request(app).post(`/api/sponsors/${sponsorId}/logo`).attach('file', html, {filename: 'x.html', contentType: 'text/html'})).status).toBe(400);
    expect((await request(app).post(`/api/sponsors/${sponsorId}/logo`).attach('file', html, {filename: 'x.png', contentType: 'image/png'})).status).toBe(400);
    expect((await prisma.sponsor.findUnique({where: {id: sponsorId}}))?.logoUrl).toBe(`${TEST_ORGANIZATION_SLUG}/sec-upload-sponsor.png`);
  });
});
