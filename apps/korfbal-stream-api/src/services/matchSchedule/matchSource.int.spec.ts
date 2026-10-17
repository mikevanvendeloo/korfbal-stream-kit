import fs from 'node:fs';
import path from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {ensureOrganization, testDb as prisma} from '../../../test-helpers';
import {runWithOrganization} from '../organizationContext';
import {getMatchScheduleProvider, MatchSourceNotConfiguredError} from './matchSource';

const runDb = process.env.REQUIRE_DB === 'true';

/** Every .ts file under src, without the specs. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.includes('.spec.') ? [full] : [];
  });
}

describe('the match source is configured in Beheer only', () => {
  it('reads no MATCH_SCHEDULE_* env vars anywhere', () => {
    const readers = sourceFiles(path.join(__dirname, '../..')).filter((file) => fs.readFileSync(file, 'utf8').includes('MATCH_SCHEDULE_'));
    expect(readers).toEqual([]);
  });
});

describe.runIf(runDb)('the match source is configured in Beheer only (integration)', () => {
  const SLUG = 'match-source-env';
  const ENV_KEYS = ['MATCH_SCHEDULE_BASE_URL', 'MATCH_SCHEDULE_API_TOKEN', 'MATCH_SCHEDULE_PROVIDER'] as const;
  const previousEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
  let organizationId: number;

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, SLUG, 'Match Source Env');
    for (const key of ENV_KEYS) previousEnv[key] = process.env[key];
    process.env.MATCH_SCHEDULE_BASE_URL = 'https://env.example/v1';
    process.env.MATCH_SCHEDULE_API_TOKEN = 'env-token';
    process.env.MATCH_SCHEDULE_PROVIDER = 'vrijwilligers';
  });

  afterAll(async () => {
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
    await prisma.organization.deleteMany({where: {slug: SLUG}});
  });

  it('ignores the old env vars: without a source in Beheer there is no match import', async () => {
    await expect(runWithOrganization(organizationId, getMatchScheduleProvider)).rejects.toBeInstanceOf(MatchSourceNotConfiguredError);
    expect(await runWithOrganization(organizationId, () => prisma.matchSource.count())).toBe(0);
  });
});
