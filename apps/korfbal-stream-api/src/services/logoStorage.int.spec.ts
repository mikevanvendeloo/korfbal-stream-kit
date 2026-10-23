import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {ensureOrganization, inOrganization, testDb as prisma} from '../../test-helpers';
import {prismaUnscoped} from './prisma';
import {migrateLogoStorage, renameOrganizationLogoFiles} from './logoStorage';

const runDb = process.env.REQUIRE_DB === 'true';

/**
 * The startup step that moves logos into the slug directories, on a temporary ASSETS_DIR (never the
 * real storage/). Organizations and sponsors are real rows in the test database.
 */
describe.runIf(runDb)('logo storage migration (integration)', () => {
  const A = 'logo-mig-a';
  const B = 'logo-mig-b';
  let a: number;
  let b: number;
  let root: string;
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
    fs.writeFileSync(path.join(root, rel), content);
  };
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
  const exists = (rel: string) => fs.existsSync(path.join(root, rel));

  beforeAll(async () => {
    a = await ensureOrganization(prisma, A, 'Logo Mig A');
    b = await ensureOrganization(prisma, B, 'Logo Mig B');
    await inOrganization(A, async () => {
      await prisma.sponsor.createMany({data: [
        {name: 'Mig Eigen', type: 'goud', websiteUrl: 'https://x.example', logoUrl: 'logo-mig-eigen.png'},
        {name: 'Mig Plat', type: 'goud', websiteUrl: 'https://x.example', logoUrl: 'logo-mig-plat.png'},
        {name: 'Mig Gedeeld', type: 'goud', websiteUrl: 'https://x.example', logoUrl: 'logo-mig-gedeeld.png'},
        {name: 'Mig Conflict', type: 'goud', websiteUrl: 'https://x.example', logoUrl: 'logo-mig-conflict.png'},
      ]});
    });
    await inOrganization(B, () => prisma.sponsor.create({data: {name: 'Mig Gedeeld', type: 'goud', websiteUrl: 'https://x.example', logoUrl: 'logo-mig-gedeeld.png'}}));
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [A, B]}}});
  });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-mig-'));
  });

  afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

  it('moves id directories, legacy files and organization logos into the slug directories, once', async () => {
    write(`sponsors/${a}/logo-mig-eigen.png`, 'eigen');
    write('sponsors/logo-mig-plat.png', 'plat');
    write('sponsors/logo-mig-gedeeld.png', 'gedeeld');
    write('sponsors/niemand-gebruikt-dit.png', 'los');
    write(`organizations/${a}.png`, 'org-a');
    write(`organizations/${b}.webp`, 'org-b');

    const first = await migrateLogoStorage({assetsRoot: root});
    expect(first).toMatchObject({movedFromIdPaths: 3, legacyMoved: 1, legacyCopied: 2, conflicts: 0});

    expect(read(`sponsors/${A}/logo-mig-eigen.png`)).toBe('eigen');
    expect(exists(`sponsors/${a}`)).toBe(false); // the empty id directory is gone
    // Only A uses it: moved
    expect(read(`sponsors/${A}/logo-mig-plat.png`)).toBe('plat');
    expect(exists('sponsors/logo-mig-plat.png')).toBe(false);
    // A and B use it: copied into both, the original stays
    expect(read(`sponsors/${A}/logo-mig-gedeeld.png`)).toBe('gedeeld');
    expect(read(`sponsors/${B}/logo-mig-gedeeld.png`)).toBe('gedeeld');
    expect(exists('sponsors/logo-mig-gedeeld.png')).toBe(true);
    // Nobody uses it: left alone
    expect(exists('sponsors/niemand-gebruikt-dit.png')).toBe(true);
    expect(read(`organizations/${A}.png`)).toBe('org-a');
    expect(read(`organizations/${B}.webp`)).toBe('org-b');
    expect(exists(`organizations/${a}.png`)).toBe(false);

    // Idempotent: a second run changes nothing
    const second = await migrateLogoStorage({assetsRoot: root});
    expect(second).toMatchObject({movedFromIdPaths: 0, legacyMoved: 0, legacyCopied: 0, conflicts: 0});
    expect(read(`sponsors/${A}/logo-mig-gedeeld.png`)).toBe('gedeeld');
  });

  it('never overwrites a target: other content is a conflict (both kept), the same content is just tidied', async () => {
    write(`sponsors/${A}/logo-mig-conflict.png`, 'nieuw');
    write('sponsors/logo-mig-conflict.png', 'oud');
    write(`sponsors/${A}/logo-mig-eigen.png`, 'zelfde');
    write(`sponsors/${a}/logo-mig-eigen.png`, 'zelfde');
    write(`organizations/${A}.png`, 'bestaand');
    write(`organizations/${a}.png`, 'ander');

    const summary = await migrateLogoStorage({assetsRoot: root, organizationIds: [a]});
    expect(summary).toMatchObject({conflicts: 2, alreadyThere: 1});
    expect(read(`sponsors/${A}/logo-mig-conflict.png`)).toBe('nieuw');
    expect(read('sponsors/logo-mig-conflict.png')).toBe('oud');
    expect(exists(`sponsors/${a}`)).toBe(false); // the duplicate in the id directory was removed
    expect(read(`organizations/${A}.png`)).toBe('bestaand');
    expect(read(`organizations/${a}.png`)).toBe('ander');
  });

  it('does not follow or move symlinks', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-mig-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'geheim.png'), 'geheim');
      fs.mkdirSync(path.join(root, 'sponsors'), {recursive: true});
      fs.symlinkSync(path.join(outside, 'geheim.png'), path.join(root, 'sponsors', 'logo-mig-plat.png'));
      fs.symlinkSync(outside, path.join(root, 'sponsors', String(a)));
      await migrateLogoStorage({assetsRoot: root, organizationIds: [a]});
      expect(exists(`sponsors/${A}/logo-mig-plat.png`)).toBe(false);
      expect(exists(`sponsors/${A}/geheim.png`)).toBe(false);
      expect(fs.readFileSync(path.join(outside, 'geheim.png'), 'utf8')).toBe('geheim');
    } finally {
      fs.rmSync(outside, {recursive: true, force: true});
    }
  });

  it('renames sponsors/<old> and organizations/<old>.* with the slug, and moves them back when the database fails', async () => {
    write('sponsors/oud/x.png', 'x');
    write('organizations/oud.gif', 'logo');
    await renameOrganizationLogoFiles('oud', 'nieuw', async () => undefined, root);
    expect(read('sponsors/nieuw/x.png')).toBe('x');
    expect(read('organizations/nieuw.gif')).toBe('logo');
    expect(exists('sponsors/oud')).toBe(false);

    await expect(renameOrganizationLogoFiles('nieuw', 'derde', async () => { throw new Error('db weg'); }, root)).rejects.toThrow('db weg');
    expect(read('sponsors/nieuw/x.png')).toBe('x');
    expect(read('organizations/nieuw.gif')).toBe('logo');
    expect(exists('sponsors/derde')).toBe(false);

    write('sponsors/bezet/y.png', 'y');
    await expect(renameOrganizationLogoFiles('nieuw', 'bezet', async () => undefined, root)).rejects.toMatchObject({status: 409});
    expect(read('sponsors/nieuw/x.png')).toBe('x');
  });
});

describe.runIf(runDb)('logo file names migration (SQL, integration)', () => {
  it('keeps only the file name: <id>/<file> for sponsors, <slug>.<ext> for organizations', async () => {
    const organizationId = await ensureOrganization(prisma, 'logo-sql', 'Logo SQL');
    try {
      await inOrganization('logo-sql', () => prisma.sponsor.createMany({data: [
        {name: 'Sql Id', type: 'goud', websiteUrl: 'https://x.example', logoUrl: `${organizationId}/sql-id.png`},
        {name: 'Sql Plat', type: 'goud', websiteUrl: 'https://x.example', logoUrl: 'Sql_Plat.PNG'},
      ]}));
      await prisma.organization.update({where: {id: organizationId}, data: {logoUrl: `organizations/${organizationId}.PNG`}});
      const sql = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261023100000_logo_file_names/migration.sql'), 'utf8');
      // Run only on this organization's rows: the statements with an extra condition
      for (const statement of sql.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean)) {
        const table = /UPDATE "(\w+)"/.exec(statement)![1];
        const scope = table === 'Organization' ? `"id" = ${organizationId}` : `"organizationId" = ${organizationId}`;
        await prismaUnscoped.$executeRawUnsafe(`${statement} AND ${scope}`);
      }
      const sponsors = await inOrganization('logo-sql', () => prisma.sponsor.findMany({orderBy: {name: 'asc'}}));
      expect(sponsors.map((s) => s.logoUrl)).toEqual(['sql-id.png', 'Sql_Plat.PNG']);
      expect((await prisma.organization.findUnique({where: {id: organizationId}}))?.logoUrl).toBe('logo-sql.png');
    } finally {
      await prisma.organization.deleteMany({where: {id: organizationId}});
    }
  });
});
