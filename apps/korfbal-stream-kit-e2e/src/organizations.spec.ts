import {db, ensureOrganization, expect, ORGANIZATION_STORAGE_KEY, test} from './support/fixtures';
import {LiveNav, OrganizationMenu, organizationSwitch, pageWidth, StartScreen} from './support/pages';

/**
 * Choosing and switching organization (design D2/D3): the start screen, the name in the nav, and that
 * nothing of the previous organization stays on screen after a switch.
 */
const NOORD = {slug: 'e2e-noord', name: 'E2E Noord'};
const ZUID = {slug: 'e2e-zuid', name: 'E2E Zuid'};

// Start without a choice: the start screen comes first
test.use({organization: null});

test.beforeAll(async () => {
  for (const o of [NOORD, ZUID]) {
    await ensureOrganization(db, o.slug, o.name);
    await db.organization.update({where: {slug: o.slug}, data: {name: o.name, isActive: true}});
  }
});

test.afterAll(async () => {
  // Removes everything in them as well
  await db.organization.deleteMany({where: {slug: {in: [NOORD.slug, ZUID.slug]}}});
});

const organizationId = async (slug: string) => (await db.organization.findUniqueOrThrow({where: {slug}})).id;

test('chooses an organization on the start screen; its name is in the nav and it is remembered', async ({page}) => {
  await page.goto('/');
  const start = new StartScreen(page);
  await expect(start.button(NOORD.name)).toBeVisible();
  await expect(start.button(ZUID.name)).toBeVisible();
  await start.choose(NOORD.name);

  await expect(new OrganizationMenu(page).menu(NOORD.name)).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), ORGANIZATION_STORAGE_KEY)).toBe(NOORD.slug);

  // Same URLs, no new choice after a reload, and Beheer has it too
  await page.reload();
  await expect(new OrganizationMenu(page).menu(NOORD.name)).toBeVisible();
  await page.goto('/admin');
  await expect(new OrganizationMenu(page).menu(NOORD.name)).toBeVisible();
});

test('switches organization from the nav, also on a phone', async ({page}) => {
  await page.goto('/admin');
  await new StartScreen(page).choose(NOORD.name);
  const beheer = new OrganizationMenu(page);
  await beheer.switchOrganization(NOORD.name);
  await new StartScreen(page).choose(ZUID.name);
  await expect(beheer.menu(ZUID.name)).toBeVisible();

  await page.setViewportSize({width: 360, height: 780});
  await page.goto('/');
  await new LiveNav(page).switchOrganization(ZUID.name);
  // The start screen fits the phone too
  await expect(new StartScreen(page).heading).toBeVisible();
  expect(await pageWidth(page)).toBe(360);
  await new StartScreen(page).choose(NOORD.name);
  await page.getByRole('button', {name: 'Menu openen'}).click();
  await expect(organizationSwitch(page, NOORD.name)).toBeVisible();
});

test('shows nothing of the previous organization after a switch', async ({page, makeShow}) => {
  await makeShow({organizationId: await organizationId(NOORD.slug), match: {homeTeamName: 'Noord Thuis', awayTeamName: 'Noord Uit'}});
  await makeShow({organizationId: await organizationId(ZUID.slug), match: {homeTeamName: 'Zuid Thuis', awayTeamName: 'Zuid Uit'}});

  await page.goto('/');
  await new StartScreen(page).choose(NOORD.name);
  await expect(page.getByText('Noord Thuis vs Noord Uit')).toBeVisible();

  // Zuid's active production comes slowly: in the meantime a kept cache would still show Noord's production
  const sent: Array<string | null> = [];
  let switching = false;
  await page.route('**/api/**', async (route) => {
    const organization = route.request().headers()['x-organization'] ?? null;
    if (switching) sent.push(organization);
    if (organization === ZUID.slug && new URL(route.request().url()).pathname === '/api/production/active') {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.continue();
  });

  await new OrganizationMenu(page).switchOrganization(NOORD.name);
  // From here on (Noord's app is gone, the start screen is up) nothing may go as Noord
  await expect(new StartScreen(page).heading).toBeVisible();
  switching = true;
  await new StartScreen(page).choose(ZUID.name);
  await expect(page.getByText('Noord Thuis vs Noord Uit')).toHaveCount(0);
  await expect(page.getByText('Zuid Thuis vs Zuid Uit')).toBeVisible({timeout: 10_000});
  await expect(page.getByText('Noord Thuis vs Noord Uit')).toHaveCount(0);
  // Every API call after the switch went as Zuid (the organization list itself needs none)
  expect(sent.filter((o) => o !== null && o !== ZUID.slug)).toEqual([]);
});

test('asks again when the chosen organization is switched off', async ({page}) => {
  await page.goto('/');
  await new StartScreen(page).choose(ZUID.name);
  await expect(new OrganizationMenu(page).menu(ZUID.name)).toBeVisible();
  await db.organization.update({where: {slug: ZUID.slug}, data: {isActive: false}});
  try {
    await page.reload();
    const start = new StartScreen(page);
    await expect(start.heading).toBeVisible();
    await expect(start.button(ZUID.name)).toHaveCount(0);
  } finally {
    await db.organization.update({where: {slug: ZUID.slug}, data: {isActive: true}});
  }
});
