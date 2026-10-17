import {afterAll, describe, expect, it, vi} from 'vitest';
import {ensureOrganization, recordQueries, testDb as prisma} from '../../test-helpers';
import {runWithOrganization} from './organizationContext';
import {prisma as appPrisma} from './prisma';
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

  it('does not cache an old value read while a write was running', async () => {
    const [a] = await Promise.all(slugs.map((slug) => ensureOrganization(prisma, slug)));
    await runWithOrganization(a, async () => {
      await setSetting('raceKey', 'old');
      clearSettingsCache(['raceKey']);
      const oldRow = await prisma.organizationSetting.findFirst({where: {key: 'raceKey'}});
      // The read starts during the write and answers (with the old row) only after the write is done
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const delegate = (appPrisma as unknown as {organizationSetting: {findFirst: (...args: unknown[]) => Promise<unknown>}}).organizationSetting;
      const spy = vi.spyOn(delegate, 'findFirst').mockImplementationOnce(async () => {
        await gate;
        return oldRow;
      });
      const write = setSetting('raceKey', 'new');
      const read = getSetting('raceKey');
      await write;
      release();
      await read;
      spy.mockRestore();
      expect(await getSetting('raceKey')).toBe('new');
      await prisma.organizationSetting.deleteMany({where: {key: 'raceKey'}});
      clearSettingsCache(['raceKey']);
    });
  });

  it('needs an organization for organization settings', async () => {
    await expect(getSetting('vmixWebUrl')).rejects.toThrow(/needs an organization/);
  });
});
