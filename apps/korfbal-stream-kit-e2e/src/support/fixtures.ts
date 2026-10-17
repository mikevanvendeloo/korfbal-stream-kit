import {test as base} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
// Test-only: the e2e tests share the API's scenario builder, so there is one place for test data
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  createProductionScenario,
  DEFAULT_ITEMS,
  ensureOrganization,
  ProductionScenario,
  ScenarioOptions,
  TEST_ORGANIZATION_SLUG,
} from '../../../korfbal-stream-api/test-scenarios';

export {ensureOrganization, TEST_ORGANIZATION_SLUG};

/** localStorage key of the chosen organization (kit: lib/organization.ts) */
export const ORGANIZATION_STORAGE_KEY = 'organization';

/**
 * Shared setup for the e2e tests. The test data comes from the same scenario builder as the API's
 * integration tests (apps/korfbal-stream-api/test-scenarios.ts), on the TEST database
 * (playwright.config.ts refuses any other).
 */
export const db = new PrismaClient({datasourceUrl: process.env['E2E_DATABASE_URL']});
export const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3335';

/** Same rule as the app (PositionSelector): "Camera links" → "camera-links". */
export const positionSlug = (name: string) => name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

export type LiveShow = ProductionScenario & {
  /** Item titles in show order */
  titles: string[];
};

type Options = {
  /**
   * Organization the browser starts with (stored before the page loads, as if chosen on the start
   * screen) and that direct API calls (`request`) send as X-Organization. Default: the test
   * organization. `test.use({organization: null})` starts on the start screen.
   */
  organization: string | null;
};

type Fixtures = {
  /** An active production with the default callsheet items; stopped and removed after the test */
  liveShow: LiveShow;
  /** Make your own scenario; everything made with it is cleaned up after the test */
  makeShow: (options?: ScenarioOptions) => Promise<LiveShow>;
};

export const test = base.extend<Fixtures & Options>({
  organization: [TEST_ORGANIZATION_SLUG, {option: true}],
  page: async ({page, organization}, use) => {
    if (organization) {
      await ensureOrganization(db, organization);
      // Only when nothing is chosen yet: a test that switches keeps its choice over a reload
      await page.addInitScript(([key, slug]) => {
        try {
          if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, slug);
        } catch {
          // storage blocked: the start screen will ask
        }
      }, [ORGANIZATION_STORAGE_KEY, organization] as const);
    }
    await use(page);
  },
  request: async ({playwright, organization}, use) => {
    const context = await playwright.request.newContext({extraHTTPHeaders: organization ? {'X-Organization': organization} : {}});
    await use(context);
    await context.dispose();
  },
  makeShow: async ({request, organization}, use) => {
    const made: ProductionScenario[] = [];
    await use(async (options = {}) => {
      // In the organization the browser uses, unless the test says otherwise
      const organizationId = organization ? await ensureOrganization(db, organization) : undefined;
      const show = await createProductionScenario(db, {active: true, organizationId, ...options});
      made.push(show);
      return {...show, titles: (options.items ?? DEFAULT_ITEMS).map((i) => i.title)};
    });
    for (const show of made) {
      // Stop the live show, so the API's in-memory state doesn't point at a removed production
      const slug = (await db.organization.findUnique({where: {id: show.organizationId}, select: {slug: true}}))?.slug;
      await request.post(`${apiUrl}/api/show/stop/${show.productionId}`, {headers: slug ? {'X-Organization': slug} : {}}).catch(() => undefined);
      await show.cleanup();
    }
  },
  liveShow: async ({makeShow}, use) => {
    await use(await makeShow());
  },
});

export {expect} from '@playwright/test';
