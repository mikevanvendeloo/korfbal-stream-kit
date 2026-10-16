import {expect, positionSlug, test} from './support/fixtures';
import {LiveNav, pageWidth, ShowCallerPhone} from './support/pages';

/**
 * LIVE on a phone (Galaxy S25: 360 x 780) against the real API and the test database: the compact bar,
 * the one-hand Show Caller and its buttons, and nothing wider than the screen.
 */
test.use({viewport: {width: 360, height: 780}, isMobile: true, hasTouch: true, deviceScaleFactor: 3});

const REGIE = 'Scenario Regie';

test('the LIVE bar fits the phone and opens the Show Caller from its menu', async ({page, liveShow}) => {
  await page.goto('/');
  await expect(page.getByText('Scenario Thuis vs Scenario Uit')).toBeVisible();
  expect(await pageWidth(page)).toBe(360);

  await new LiveNav(page).open('Show Caller');
  await expect(page).toHaveURL(new RegExp(`/show-caller/${liveShow.productionId}/all$`));
  const showCaller = new ShowCallerPhone(page);
  await showCaller.expectNotStarted();
  await expect(showCaller.next).toContainText(liveShow.titles[0]);
});

test('runs the show with the buttons under the thumb', async ({page, liveShow}) => {
  const showCaller = new ShowCallerPhone(page);
  await showCaller.open(liveShow.productionId, positionSlug(REGIE));

  await showCaller.start();
  await showCaller.expectNow(liveShow.titles[0]);
  await showCaller.nextItem();
  await showCaller.expectNow(liveShow.titles[1]);

  // Next is the camera's item: shown, because Next activates it, but marked as not for this position
  await expect(showCaller.next).toContainText(liveShow.titles[2]);
  await expect(showCaller.next).toContainText('niet voor jouw positie');
  await expect(showCaller.later).toContainText(liveShow.titles[3]);

  await showCaller.previousItem();
  await showCaller.expectNow(liveShow.titles[0]);

  await showCaller.stop();
  await showCaller.expectNotStarted();
});

test('Zet 30s sets the remaining time of the current item', async ({page, liveShow}) => {
  const showCaller = new ShowCallerPhone(page);
  await showCaller.open(liveShow.productionId);
  await showCaller.start();
  await showCaller.expectNow(liveShow.titles[0]);

  await showCaller.setRemaining(30);
  // Wait for the new time itself: a value read before the update (e.g. 0 or the full minute) doesn't count
  await expect.poll(async () => {
    const remaining = await showCaller.remainingSeconds();
    return remaining > 25 && remaining <= 30;
  }).toBe(true);
});

test('the buttons stay in view while scrolling, and the page never scrolls sideways', async ({page, liveShow}) => {
  const showCaller = new ShowCallerPhone(page);
  await showCaller.open(liveShow.productionId);
  await showCaller.start();
  await page.mouse.wheel(0, 2000);
  await expect(showCaller.controls.getByRole('button', {name: 'Volgend item'})).toBeInViewport();
  expect(await pageWidth(page)).toBe(360);
});

test('shows a failed action on screen', async ({page, liveShow}) => {
  const showCaller = new ShowCallerPhone(page);
  await showCaller.open(liveShow.productionId);
  await showCaller.start();
  await showCaller.expectNow(liveShow.titles[0]);
  await showCaller.previousItem();
  await expect(page.getByRole('alert')).toHaveText('Dit is het eerste item.');
});

test('the callsheet and the position choice fit the phone', async ({page, liveShow}) => {
  await page.goto(`/callsheet/${liveShow.productionId}`);
  await expect(page.getByText('Kies je positie')).toBeVisible();
  expect(await pageWidth(page)).toBe(360);

  await page.getByText(REGIE, {exact: true}).click();
  await expect(page).toHaveURL(new RegExp(`/callsheet/${liveShow.productionId}/${positionSlug(REGIE)}$`));
  await expect(page.getByText(liveShow.titles[0])).toBeVisible();
  expect(await pageWidth(page)).toBe(360);
});

test('the help button opens the manual at the Show Caller', async ({page, liveShow}) => {
  await new ShowCallerPhone(page).open(liveShow.productionId);
  await new LiveNav(page).help().click();
  await expect(page).toHaveURL(/\/handleiding\/show-caller$/);
  await expect(page.getByRole('heading', {level: 1, name: 'De Show Caller'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Op je telefoon'})).toBeVisible();
});
