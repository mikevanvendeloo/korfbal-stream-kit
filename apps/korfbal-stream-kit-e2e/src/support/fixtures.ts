import {test as base} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
// Test-only: the e2e tests share the API's scenario builder, so there is one place for test data
// eslint-disable-next-line @nx/enforce-module-boundaries
import {createProductionScenario, DEFAULT_ITEMS, ProductionScenario, ScenarioOptions} from '../../../korfbal-stream-api/test-scenarios';

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

type Fixtures = {
  /** An active production with the default callsheet items; stopped and removed after the test */
  liveShow: LiveShow;
  /** Make your own scenario; everything made with it is cleaned up after the test */
  makeShow: (options?: ScenarioOptions) => Promise<LiveShow>;
};

export const test = base.extend<Fixtures>({
  makeShow: async ({request}, use) => {
    const made: ProductionScenario[] = [];
    await use(async (options = {}) => {
      const show = await createProductionScenario(db, {active: true, ...options});
      made.push(show);
      return {...show, titles: (options.items ?? DEFAULT_ITEMS).map((i) => i.title)};
    });
    for (const show of made) {
      // Stop the live show, so the API's in-memory state doesn't point at a removed production
      await request.post(`${apiUrl}/api/show/stop/${show.productionId}`).catch(() => undefined);
      await show.cleanup();
    }
  },
  liveShow: async ({makeShow}, use) => {
    await use(await makeShow());
  },
});

export {expect} from '@playwright/test';
