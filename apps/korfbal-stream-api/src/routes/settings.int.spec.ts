import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {ensureOrganization, testDb as prisma} from '../../test-helpers';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {runWithOrganization} from '../services/organizationContext';
import {clearSettingsCache, getSetting, setSetting} from '../services/appSettings';
import {ACTIVE_SEASON_ID_KEY} from '../services/season';
import {loadInterviewNames} from '../services/interviewPlaceholders';

const runDb = process.env.REQUIRE_DB === 'true';
const OWN = 'settings-own-club';
const OTHER = 'settings-own-club-b';

/** Organization.clubId is the one source of the own club (PR #12 review, finding 2). */
describe.runIf(runDb)('own club = Organization.clubId (integration)', () => {
  let organizationId: number;
  let clubId: number;
  let show: ProductionScenario | undefined;
  const asOwn = (r: request.Test) => r.set('X-Organization', OWN);

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, OWN, 'Settings Own Club');
    await ensureOrganization(prisma, OTHER, 'Settings Own Club B');
    clubId = (await prisma.club.create({data: {name: 'Eigen Clubtest', shortName: 'EigenClubtest', slug: 'settings-eigen-clubtest'}})).id;
  });

  afterAll(async () => {
    await show?.cleanup();
    await prisma.organization.deleteMany({where: {slug: {in: [OWN, OTHER]}}});
    await prisma.club.deleteMany({where: {slug: 'settings-eigen-clubtest'}});
  });

  it('club-config reads and writes Organization.clubId, not a setting', async () => {
    const put = await asOwn(request(app).put('/api/settings/club-config')).send({ownClubId: clubId, productionTeamNames: ['Eigen 1']});
    expect(put.status, put.text).toBe(200);
    expect((await prisma.organization.findUniqueOrThrow({where: {id: organizationId}})).clubId).toBe(clubId);
    expect(await runWithOrganization(organizationId, () => prisma.organizationSetting.count({where: {key: 'ownClubId'}}))).toBe(0);
    expect((await asOwn(request(app).get('/api/settings/club-config'))).body).toEqual({ownClubId: clubId, productionTeamNames: ['Eigen 1']});
    // Beheer → Organisaties shows the same club
    expect((await request(app).get(`/api/organizations/${organizationId}`)).body.clubId).toBe(clubId);
    // Only the own organization
    expect((await request(app).get('/api/settings/club-config').set('X-Organization', OTHER)).body.ownClubId).toBeNull();
  });

  it('shows a club linked in Beheer → Organisaties, and clears it with null', async () => {
    await request(app).put(`/api/organizations/${organizationId}`).send({clubId: null});
    expect((await asOwn(request(app).get('/api/settings/club-config'))).body.ownClubId).toBeNull();
    await request(app).put(`/api/organizations/${organizationId}`).send({clubId});
    expect((await asOwn(request(app).get('/api/settings/club-config'))).body.ownClubId).toBe(clubId);

    expect((await asOwn(request(app).put('/api/settings/club-config')).send({ownClubId: null, productionTeamNames: []})).status).toBe(200);
    expect((await prisma.organization.findUniqueOrThrow({where: {id: organizationId}})).clubId).toBeNull();
  });

  it('refuses an unknown club', async () => {
    const res = await asOwn(request(app).put('/api/settings/club-config')).send({ownClubId: 999_999_999, productionTeamNames: []});
    expect(res.status).toBe(400);
  });

  it('fills in {eigen}/{tegenstander} from the organization\'s club', async () => {
    await request(app).put(`/api/organizations/${organizationId}`).send({clubId});
    // A home match on paper, but the own club plays away: the club decides
    const scenario = await createProductionScenario(prisma, {
      organizationId, match: {homeTeamName: 'Tegenstanderclub 1', awayTeamName: 'EigenClubtest 1', isHomeMatch: true},
    });
    show = scenario;
    const names = await runWithOrganization(organizationId, () => loadInterviewNames(scenario.productionId));
    expect(names?.ownSide).toBe('AWAY');
  });
});

describe.runIf(runDb)('migration: ownClubId setting into Organization.clubId (integration)', () => {
  const MIGRATION = path.join(__dirname, '../../prisma/migrations/20261017100000_own_club_from_organization/migration.sql');
  const KEEP = 'settings-mig-keep';
  const FILL = 'settings-mig-fill';

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [KEEP, FILL]}}});
    await prisma.club.deleteMany({where: {slug: {in: ['settings-mig-a', 'settings-mig-b']}}});
  });

  it('copies the setting where clubId is empty, keeps a clubId that is set, and removes the setting', async () => {
    const [clubA, clubB] = await Promise.all(['settings-mig-a', 'settings-mig-b'].map((slug) =>
      prisma.club.create({data: {name: slug, shortName: slug, slug}})));
    const keep = await prisma.organization.create({data: {slug: KEEP, name: 'Keep', clubId: clubA.id}});
    const fill = await prisma.organization.create({data: {slug: FILL, name: 'Fill'}});
    for (const organization of [keep, fill]) {
      await runWithOrganization(organization.id, () => prisma.organizationSetting.create({data: {key: 'ownClubId', value: clubB.id}}));
    }
    const statements = fs.readFileSync(MIGRATION, 'utf8')
      .split(/;\s*$/m).map((sql) => sql.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const sql of statements) await prisma.$executeRawUnsafe(sql);

    expect((await prisma.organization.findUniqueOrThrow({where: {id: keep.id}})).clubId).toBe(clubA.id);
    expect((await prisma.organization.findUniqueOrThrow({where: {id: fill.id}})).clubId).toBe(clubB.id);
    for (const organization of [keep, fill]) {
      expect(await runWithOrganization(organization.id, () => prisma.organizationSetting.count({where: {key: 'ownClubId'}}))).toBe(0);
    }
    clearSettingsCache();
  });
});

describe.runIf(runDb)('settings restore of one organization (integration)', () => {
  const RESTORE = 'settings-restore';
  let organizationId: number;
  let activeBefore: number | null;

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, RESTORE, 'Settings Restore');
    activeBefore = await getSetting<number>(ACTIVE_SEASON_ID_KEY);
  });

  afterAll(async () => {
    await setSetting(ACTIVE_SEASON_ID_KEY, activeBefore);
    await prisma.organization.deleteMany({where: {slug: RESTORE}});
    await prisma.club.deleteMany({where: {slug: 'settings-restore-club'}});
  });

  it('skips installation-wide keys: the active season stays for every organization', async () => {
    const seasonsBefore = await prisma.season.count();
    const res = await request(app).post('/api/backup/settings/import').set('X-Organization', RESTORE).send([
      {key: 'activeSeasonName', value: '2031/2032'},
      {key: ACTIVE_SEASON_ID_KEY, value: 12345},
      {key: 'vmixWebUrl', value: 'http://restored-vmix'},
    ]);
    expect(res.status, res.text).toBe(200);
    expect(res.body).toMatchObject({ok: true, created: 1, updated: 0});
    clearSettingsCache();
    expect(await getSetting<number>(ACTIVE_SEASON_ID_KEY)).toBe(activeBefore);
    expect(await prisma.season.count()).toBe(seasonsBefore); // the named season isn't even created
    expect(await runWithOrganization(organizationId, () => getSetting('vmixWebUrl'))).toBe('http://restored-vmix');
  });

  it('puts the own club of an old backup (ownClubId) on the organization', async () => {
    const club = await prisma.club.create({data: {name: 'Restore Club', shortName: 'RestoreClub', slug: 'settings-restore-club'}});
    const res = await request(app).post('/api/backup/settings/import').set('X-Organization', RESTORE).send([{key: 'ownClubId', value: club.id}]);
    expect(res.status, res.text).toBe(200);
    expect((await prisma.organization.findUniqueOrThrow({where: {id: organizationId}})).clubId).toBe(club.id);
    expect(await runWithOrganization(organizationId, () => prisma.organizationSetting.count({where: {key: 'ownClubId'}}))).toBe(0);
    // A club that doesn't exist here is skipped
    await request(app).post('/api/backup/settings/import').set('X-Organization', RESTORE).send([{key: 'ownClubId', value: 999_999_999}]);
    expect((await prisma.organization.findUniqueOrThrow({where: {id: organizationId}})).clubId).toBe(club.id);
  });
});
