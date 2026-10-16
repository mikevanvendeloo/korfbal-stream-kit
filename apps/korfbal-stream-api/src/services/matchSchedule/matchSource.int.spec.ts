import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {testDb as prisma} from '../../../test-helpers';
import {runWithOrganization} from '../organizationContext';
import {copyMatchSourceFromEnv, DEFAULT_MATCH_SOURCE_BASE_URL} from './matchSource';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('MATCH_SCHEDULE_* env copied once into Fortuna (integration)', () => {
  let fortuna: number;
  let previous: unknown;

  beforeAll(async () => {
    // The migration creates Fortuna
    fortuna = (await prisma.organization.findUniqueOrThrow({where: {slug: 'fortuna'}})).id;
    previous = await runWithOrganization(fortuna, () => prisma.matchSource.findFirst());
    await runWithOrganization(fortuna, () => prisma.matchSource.deleteMany());
  });

  afterAll(async () => {
    await runWithOrganization(fortuna, async () => {
      await prisma.matchSource.deleteMany();
      if (previous) await prisma.matchSource.create({data: previous as never});
    });
  });

  it('does nothing without the env vars', async () => {
    expect(await copyMatchSourceFromEnv({})).toBe(false);
    expect(await runWithOrganization(fortuna, () => prisma.matchSource.count())).toBe(0);
  });

  it('copies them when Fortuna has no source, and only then', async () => {
    expect(await copyMatchSourceFromEnv({MATCH_SCHEDULE_API_TOKEN: 'env-token'})).toBe(true);
    const source = await runWithOrganization(fortuna, () => prisma.matchSource.findFirstOrThrow());
    expect(source).toMatchObject({provider: 'vrijwilligers', baseUrl: DEFAULT_MATCH_SOURCE_BASE_URL, apiToken: 'env-token', isEnabled: true});

    expect(await copyMatchSourceFromEnv({MATCH_SCHEDULE_API_TOKEN: 'other', MATCH_SCHEDULE_BASE_URL: 'https://other.example'})).toBe(false);
    expect((await runWithOrganization(fortuna, () => prisma.matchSource.findFirstOrThrow())).apiToken).toBe('env-token');
  });
});
