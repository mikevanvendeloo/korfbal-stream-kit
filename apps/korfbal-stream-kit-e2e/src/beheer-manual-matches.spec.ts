import {apiUrl, db, expect, test} from './support/fixtures';
import {ManualMatchesPage} from './support/pages';

/**
 * Times mean Amsterdam time on every device: a browser set to UTC (and the API running with TZ=UTC,
 * as in Docker, see playwright.config.ts) still shows 19:30 for a match created at 19:30.
 */
test.use({timezoneId: 'UTC'});

const HOME = 'E2E Tijdzone Thuis';
const AWAY = 'E2E Tijdzone Uit';

test.afterEach(async () => {
  await db.matchSchedule.deleteMany({where: {homeTeamName: HOME, isManual: true}});
});

test('a manual match created at 19:30 shows 19:30 again when reopened', async ({page, request}) => {
  // In November of the active season, so the list (active season) shows it; winter time, UTC+1
  const active = await (await request.get(`${apiUrl}/api/seasons/active`)).json();
  const day = `${active.startYear}-11-14`;

  const matches = new ManualMatchesPage(page);
  await matches.open();
  await matches.create({date: `${day}T19:30`, home: HOME, away: AWAY});

  await expect(matches.row(HOME, AWAY)).toContainText(`14-11-${active.startYear} 19:30`);
  // Stored as UTC
  const stored = await db.matchSchedule.findFirstOrThrow({where: {homeTeamName: HOME, isManual: true}});
  expect(stored.date.toISOString()).toBe(`${day}T18:30:00.000Z`);

  await page.reload();
  await matches.edit(HOME, AWAY);
  await expect(matches.dateField()).toHaveValue(`${day}T19:30`);
});
