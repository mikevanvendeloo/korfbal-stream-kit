import {afterAll, describe, expect, it} from 'vitest';
import {ensureOrganization, testDb as prisma} from '../../test-helpers';
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

  it('needs an organization for organization settings', async () => {
    await expect(getSetting('vmixWebUrl')).rejects.toThrow(/needs an organization/);
  });
});
