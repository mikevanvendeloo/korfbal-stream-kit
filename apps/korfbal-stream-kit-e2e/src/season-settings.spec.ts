import type { Page } from '@playwright/test';
import { expect, test, TEST_ORGANIZATION_SLUG } from './support/fixtures';

// The season API is mocked with page.route so this flow stays deterministic (the real API isn't reached).

type Season = {
  id: number; startYear: number; name: string; startDate: string; endDate: string;
  isActive: boolean; matchCount: number; playerCount: number; indoorStartDate: string | null; createdAt: string;
};

const mk = (id: number, startYear: number, over: Partial<Season> = {}): Season => ({
  id, startYear, name: `${startYear}/${startYear + 1}`,
  startDate: `${startYear}-06-30T22:00:00.000Z`, endDate: `${startYear + 1}-06-30T21:59:59.999Z`,
  isActive: false, matchCount: 0, playerCount: 0, indoorStartDate: null, createdAt: '2025-07-01T00:00:00.000Z',
  ...over,
});

async function mockSeasonApi(page: Page, importDates: (string | null)[] = []) {
  let seasons: Season[] = [mk(1, 2025, { isActive: true, matchCount: 12, playerCount: 80 })];
  let nextId = 2;

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData() as string) : undefined;

    // The fixture chose the test organization; the start screen checks it against this list
    if (pathname === '/api/organizations') {
      return route.fulfill({ json: [{ id: 1, slug: TEST_ORGANIZATION_SLUG, name: 'Test', logoUrl: null, clubId: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', displayLogoUrl: null, initials: 'TE' }] });
    }
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
    if (pathname.startsWith('/api/seasons/') && method === 'PUT') {
      const id = Number(pathname.split('/').pop());
      seasons = seasons.map(s => (s.id === id ? { ...s, indoorStartDate: body.indoorStartDate } : s));
      return route.fulfill({ json: seasons.find(s => s.id === id) });
    }
    if (pathname.startsWith('/api/seasons/') && method === 'DELETE') {
      const id = Number(pathname.split('/').pop());
      seasons = seasons.filter(s => s.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname === '/api/match/matches/schedule/import') {
      importDates.push(new URL(req.url()).searchParams.get('date'));
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
  const importDates: (string | null)[] = [];

  test.beforeEach(async ({ page }) => {
    importDates.length = 0;
    await mockSeasonApi(page, importDates);
  });

  test('sets the indoor start date and imports the Zaalcompetitie from it', async ({ page }) => {
    await page.goto('/admin/instellingen');
    const fill = page.getByTestId('fill-season');
    const preset = fill.getByRole('radio', { name: /Zaalcompetitie/ });
    await expect(preset).toBeDisabled();
    await expect(fill.getByText('Stel de startdatum van de zaalcompetitie in bij Seizoenen')).toBeVisible();

    const start = page.getByLabel('Start zaalcompetitie 2025/2026');
    await start.fill('1-11-2025');
    await start.press('Enter');
    await expect(start).toHaveValue('01-11-2025');

    await expect(fill.getByRole('radio', { name: 'Zaalcompetitie (vanaf 1 november 2025)' })).toBeEnabled();
    await fill.getByRole('radio', { name: 'Zaalcompetitie (vanaf 1 november 2025)' }).check();
    await fill.getByRole('button', { name: 'Wedstrijden importeren' }).click();
    await expect(fill.getByTestId('match-import-result')).toContainText('(7 nieuw, 2 bijgewerkt)');
    expect(importDates).toEqual(['indoor']);

    // The free field: a date or a range
    await fill.getByLabel('Vanaf datum of periode').fill('08-02-2026');
    await fill.getByRole('button', { name: 'Wedstrijden importeren' }).click();
    await expect.poll(() => importDates).toEqual(['indoor', '08-02-2026']);
  });

  test('shows the active season badge in the nav and opens the Seizoen tab', async ({ page }) => {
    await page.goto('/admin');
    const badge = page.getByRole('link', { name: 'Seizoen 2025/2026' });
    await expect(badge).toBeVisible();
    await badge.click();

    await expect(page).toHaveURL(/\/admin\/instellingen$/);
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
    await page.goto('/admin/instellingen');

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
