import { test, expect, Page } from '@playwright/test';

// The season API is mocked with page.route so this flow runs against the plain
// frontend preview server (no API/DB needed) and stays deterministic.

type Season = {
  id: number; startYear: number; name: string; startDate: string; endDate: string;
  isActive: boolean; matchCount: number; playerCount: number; createdAt: string;
};

const mk = (id: number, startYear: number, over: Partial<Season> = {}): Season => ({
  id, startYear, name: `${startYear}/${startYear + 1}`,
  startDate: `${startYear}-06-30T22:00:00.000Z`, endDate: `${startYear + 1}-06-30T21:59:59.999Z`,
  isActive: false, matchCount: 0, playerCount: 0, createdAt: '2025-07-01T00:00:00.000Z',
  ...over,
});

async function mockSeasonApi(page: Page) {
  let seasons: Season[] = [mk(1, 2025, { isActive: true, matchCount: 12, playerCount: 80 })];
  let nextId = 2;

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData() as string) : undefined;

    if (pathname === '/api/seasons' && method === 'GET') return route.fulfill({ json: seasons });
    if (pathname === '/api/seasons/active' && method === 'GET') return route.fulfill({ json: seasons.find(s => s.isActive) });
    if (pathname === '/api/seasons/suggest-next') {
      const max = Math.max(...seasons.map(s => s.startYear));
      return route.fulfill({ json: { startYear: max + 1, name: `${max + 1}/${max + 2}` } });
    }
    if (pathname === '/api/seasons' && method === 'POST') {
      const created = mk(nextId++, Number(body.name.slice(0, 4)), { isActive: !!body.activate });
      if (body.activate) seasons = seasons.map(s => ({ ...s, isActive: false }));
      seasons = [created, ...seasons];
      return route.fulfill({ status: 201, json: created });
    }
    if (pathname === '/api/seasons/active' && method === 'PUT') {
      seasons = seasons.map(s => ({ ...s, isActive: s.id === body.seasonId }));
      return route.fulfill({ json: seasons.find(s => s.id === body.seasonId) });
    }
    if (pathname.startsWith('/api/seasons/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      seasons = seasons.filter(s => s.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname === '/api/match/matches/schedule/import') {
      return route.fulfill({
        json: {
          ok: true, inserted: 7, updated: 2, total: 9,
          bySeason: [{ seasonId: 2, name: '2026/2027', count: 6 }, { seasonId: 1, name: '2025/2026', count: 3 }],
        },
      });
    }
    if (pathname === '/api/clubs/import/league-teams') {
      return route.fulfill({ json: { ok: true, clubsCreated: 1, clubsUpdated: 5, playersCreated: 40, playersUpdated: 3, problems: [] } });
    }
    return route.fulfill({ json: [] });
  });
}

test.describe('Seizoen instellingen', () => {
  test.beforeEach(async ({ page }) => {
    await mockSeasonApi(page);
  });

  test('shows the active season badge in the nav and opens the Seizoen tab', async ({ page }) => {
    await page.goto('/');
    const badge = page.getByRole('link', { name: 'Seizoen 2025/2026' });
    await expect(badge).toBeVisible();
    await badge.click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Actief seizoen' })).toBeVisible();
    await expect(page.getByTestId('season-row-1')).toContainText('Actief');

    // The active season can always be filled, also without creating a new season first
    const fill = page.getByTestId('fill-season');
    await expect(fill.getByRole('heading', { name: 'Seizoen vullen' })).toBeVisible();
    await expect(fill).toContainText('2025/2026');
    await fill.getByRole('button', { name: 'Teams/spelers importeren' }).click();
    await expect(fill.getByText(/Spelers: 40 nieuw, 3 bijgewerkt/)).toBeVisible();
  });

  test('starts a new season, runs imports and switches back', async ({ page }) => {
    await page.goto('/settings');

    // Validation
    const name = page.getByLabel('Naam');
    await expect(name).toHaveValue('2026/2027');
    await name.fill('2026-2027');
    await expect(page.getByRole('alert')).toContainText('formaat');
    await name.fill('2026/2027');

    // Create + activate
    await expect(page.getByLabel('Direct activeren')).toBeChecked();
    await page.getByRole('button', { name: 'Seizoen aanmaken' }).click();
    const fill = page.getByTestId('fill-season');
    await expect(fill).toContainText('Seizoen 2026/2027 gestart');
    await expect(page.getByTestId('fill-season')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Seizoen 2026/2027' })).toBeVisible();

    // Fill the new season
    await fill.getByRole('button', { name: 'Wedstrijden importeren' }).click();
    await expect(fill.getByText('6 wedstrijden in 2026/2027, 3 in 2025/2026 (7 nieuw, 2 bijgewerkt)')).toBeVisible();
    await fill.getByRole('button', { name: 'Teams/spelers importeren' }).click();
    await expect(fill.getByText(/Spelers: 40 nieuw, 3 bijgewerkt/)).toBeVisible();

    // Active season cannot be deleted; switch back and delete the (empty) new one
    await expect(page.getByRole('button', { name: 'Verwijder seizoen 2026/2027' })).toBeDisabled();
    await page.getByLabel('Seizoen', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Actief seizoen opslaan' }).click();
    await expect(page.getByText('Seizoen 2025/2026 is nu actief')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Seizoen 2025/2026' })).toBeVisible();
    // The fill section follows the active season and drops the previous season's results
    await expect(page.getByTestId('fill-season')).toContainText('2025/2026');
    await expect(page.getByTestId('fill-season').getByText(/Spelers: 40 nieuw/)).toHaveCount(0);

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Verwijder seizoen 2026/2027' }).click();
    await expect(page.getByTestId('season-row-2')).toHaveCount(0);
  });
});
