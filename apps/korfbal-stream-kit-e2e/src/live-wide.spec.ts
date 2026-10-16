import {apiUrl, db, expect, test} from './support/fixtures';
import {ShowCallerWide} from './support/pages';

/** The wide Show Caller, and LIVE following the active production, against the real API and the test database. */
test.use({viewport: {width: 1440, height: 900}});

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
