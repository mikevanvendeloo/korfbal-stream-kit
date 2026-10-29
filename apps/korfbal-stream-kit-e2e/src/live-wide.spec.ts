import type {Locator} from '@playwright/test';
import {apiUrl, db, expect, test} from './support/fixtures';
import {ShowCallerWide} from './support/pages';

/** The wide Show Caller, and LIVE following the active production, against the real API and the test database. */
test.use({viewport: {width: 1440, height: 900}});

/** Vertical position on the page, to check the order of rows */
const topOf = async (locator: Locator) => (await locator.boundingBox())?.y ?? 0;

const activeTitle = async (productionId: number) =>
  (await db.productionEvent.findFirst({where: {productionId, status: 'ACTIVE'}}))?.title ?? null;

test('runs the show with the round buttons and the arrow keys', async ({page, liveShow}) => {
  const showCaller = new ShowCallerWide(page);
  await showCaller.open(liveShow.productionId);
  await showCaller.start();
  await showCaller.expectRunning();
  await expect.poll(() => activeTitle(liveShow.productionId)).toBe(liveShow.titles[0]);

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => activeTitle(liveShow.productionId)).toBe(liveShow.titles[1]);
  await showCaller.nextItem();
  await expect.poll(() => activeTitle(liveShow.productionId)).toBe(liveShow.titles[2]);
});

test('Zet 15s sets the remaining time, and the red button stops the show', async ({page, liveShow}) => {
  const showCaller = new ShowCallerWide(page);
  await showCaller.open(liveShow.productionId);
  await showCaller.start();
  await showCaller.expectRunning();

  await showCaller.setRemaining(15);
  // Wait for the new time itself, not a value read before the update
  await expect.poll(async () => {
    const remaining = await showCaller.remainingSeconds();
    return remaining > 10 && remaining <= 15;
  }).toBe(true);

  await showCaller.stop();
  await showCaller.expectStopped();
  await expect.poll(() => activeTitle(liveShow.productionId)).toBeNull();
});

test('LIVE finds the active production when another season is active', async ({page, request, liveShow}) => {
  const active = await (await request.get(`${apiUrl}/api/seasons/active`)).json();
  const other = await db.season.upsert({where: {startYear: 2099}, update: {}, create: {startYear: 2099, name: '2099/2100'}});
  await request.put(`${apiUrl}/api/seasons/active`, {data: {seasonId: other.id}});
  try {
    await page.goto('/');
    await expect(page.getByText('Scenario Thuis vs Scenario Uit')).toBeVisible();
    await page.goto('/show-caller');
    await expect(page).toHaveURL(new RegExp(`/show-caller/${liveShow.productionId}/all$`));
  } finally {
    await request.put(`${apiUrl}/api/seasons/active`, {data: {seasonId: active.id}});
    await db.season.deleteMany({where: {startYear: 2099}});
  }
});

test('shows the hoofdstukken as headings above their items, and the current one at the top', async ({page, makeShow}) => {
  const show = await makeShow({
    chapters: ['Voorbeschouwing', 'Wedstrijd'],
    items: [
      {title: 'Livestream starten', chapter: 'Voorbeschouwing', positions: ['Scenario Regie']},
      {title: 'Presentator heet welkom', positions: ['Scenario Regie']},
      {title: 'Opkomst spelers', chapter: 'Wedstrijd', positions: ['Scenario Camera']},
    ],
  });
  const showCaller = new ShowCallerWide(page);
  await showCaller.open(show.productionId);

  const before = showCaller.chapterHeading('Voorbeschouwing');
  const during = showCaller.chapterHeading('Wedstrijd');
  await expect(before).toBeVisible();
  await expect(during).toBeVisible();
  // In show order: the heading, its items, then the next heading
  const welcome = page.locator(`#row-${show.eventIds[1]}`);
  const walkOn = page.locator(`#row-${show.eventIds[2]}`);
  expect(await topOf(before)).toBeLessThan(await topOf(welcome));
  expect(await topOf(welcome)).toBeLessThan(await topOf(during));
  expect(await topOf(during)).toBeLessThan(await topOf(walkOn));

  await showCaller.start();
  await showCaller.expectRunning();
  await expect(showCaller.currentChapter()).toContainText('Hoofdstuk: Voorbeschouwing');
  await showCaller.nextItem();
  await showCaller.nextItem();
  await expect(showCaller.currentChapter()).toContainText('Hoofdstuk: Wedstrijd');
});
