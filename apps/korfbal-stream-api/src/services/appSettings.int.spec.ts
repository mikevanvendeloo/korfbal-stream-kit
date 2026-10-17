import {afterAll, describe, expect, it} from 'vitest';
import {ensureOrganization, recordQueries, testDb as prisma} from '../../test-helpers';
import {runWithOrganization} from './organizationContext';
import {clearSettingsCache, getSetting, setSetting} from './appSettings';
import {ACTIVE_SEASON_ID_KEY} from './season';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('settings per organization (integration)', () => {
  const slugs = ['settings-a', 'settings-b'];
  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: slugs}}});
  });

  it('keeps a value per organization, also through the cache', async () => {
    const [a, b] = await Promise.all(slugs.map((slug) => ensureOrganization(prisma, slug)));
    await runWithOrganization(a, () => setSetting('vmixWebUrl', 'http://a.example'));
    await runWithOrganization(b, () => setSetting('vmixWebUrl', 'http://b.example'));
    expect(await runWithOrganization(a, () => getSetting('vmixWebUrl'))).toBe('http://a.example');
    expect(await runWithOrganization(b, () => getSetting('vmixWebUrl'))).toBe('http://b.example');
    clearSettingsCache(['vmixWebUrl']);
    expect(await runWithOrganization(a, () => getSetting('vmixWebUrl'))).toBe('http://a.example');
    expect(await prisma.setting.count({where: {key: 'vmixWebUrl'}})).toBe(0);
  });

  it('keeps the active season installation-wide', async () => {
    const [a, b] = await Promise.all(slugs.map((slug) => ensureOrganization(prisma, slug)));
    const current = await runWithOrganization(a, () => getSetting<number>(ACTIVE_SEASON_ID_KEY));
    expect(await runWithOrganization(b, () => getSetting<number>(ACTIVE_SEASON_ID_KEY))).toBe(current);
    // Readable without an organization as well
    expect(await getSetting<number>(ACTIVE_SEASON_ID_KEY)).toBe(current);
  });

  it('remembers that a key is not set (no query per second for an unset scoreboardUrl), until it is set', async () => {
    const [a, b] = await Promise.all(slugs.map((slug) => ensureOrganization(prisma, slug)));
    clearSettingsCache();
    expect(await runWithOrganization(a, () => getSetting('scoreboardUrl'))).toBeNull();
    const queries = await recordQueries(async () => {
      expect(await runWithOrganization(a, () => getSetting('scoreboardUrl'))).toBeNull();
    });
    expect(queries).toEqual([]);

    await runWithOrganization(a, () => setSetting('scoreboardUrl', 'http://board.example'));
    expect(await runWithOrganization(a, () => getSetting('scoreboardUrl'))).toBe('http://board.example');
    // Per organization: B is still not set
    expect(await runWithOrganization(b, () => getSetting('scoreboardUrl'))).toBeNull();

    // Cleared: read from the database again
    await runWithOrganization(b, () => prisma.organizationSetting.create({data: {key: 'scoreboardUrl', value: 'http://b.example'}}));
    expect(await runWithOrganization(b, () => getSetting('scoreboardUrl'))).toBeNull();
    clearSettingsCache(['scoreboardUrl']);
    expect(await runWithOrganization(b, () => getSetting('scoreboardUrl'))).toBe('http://b.example');
  });

  it('needs an organization for organization settings', async () => {
    await expect(getSetting('vmixWebUrl')).rejects.toThrow(/needs an organization/);
  });
});
