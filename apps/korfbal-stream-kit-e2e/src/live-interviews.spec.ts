import {expect, positionSlug, test} from './support/fixtures';
import {CallSheetScreen, InterviewsScreen, LiveNav, pageWidth} from './support/pages';

/**
 * Interview photos in LIVE against the real API and the test database: the Interviews screen on a
 * phone, and the small photo next to a filled-in interview name in the callsheet, with its switch.
 * (No photo file in the test storage: the avatar shows the shirt number; the photo itself is a
 * component test.)
 */
const REGIE = 'Scenario Regie';
const interviews = [
  {side: 'HOME' as const, role: 'PLAYER' as const, name: 'Anna de Vries', shirtNo: 7},
  {side: 'AWAY' as const, role: 'COACH' as const, name: 'Kees Coach'},
];

test.describe('on a phone', () => {
  test.use({viewport: {width: 360, height: 780}, isMobile: true, hasTouch: true, deviceScaleFactor: 3});

  test('the Interviews screen shows the chosen people with their number, within the screen', async ({page, makeShow}) => {
    await makeShow({interviews});
    await page.goto('/');
    await new LiveNav(page).open('Interviews');
    await expect(page).toHaveURL(/\/interviews$/);

    const screen = new InterviewsScreen(page);
    const anna = screen.card('Anna de Vries');
    await expect(anna).toContainText('Speler thuis');
    await expect(anna).toContainText('#7');
    await expect(anna).toContainText('Scenario Thuis');
    await expect(anna.getByRole('img', {name: 'Anna de Vries, rugnummer 7'})).toBeVisible();
    // A coach: initials, no number
    await expect(screen.card('Kees Coach').getByRole('img', {name: 'Kees Coach'})).toHaveText('KC');
    expect(await pageWidth(page)).toBe(360);
  });
});

test('a callsheet item with {speler-thuis} shows the photo, and the gear switch hides it', async ({page, makeShow}) => {
  const show = await makeShow({
    interviews,
    items: [{title: 'Interview {speler-thuis}', positions: [REGIE]}, {title: 'Afsluiting', positions: [REGIE]}],
  });
  const callsheet = new CallSheetScreen(page);
  await callsheet.open(show.productionId, positionSlug(REGIE));

  const person = callsheet.interviewPeople().first();
  await expect(person).toContainText('Anna de Vries');
  await expect(person.getByRole('img', {name: 'Anna de Vries, rugnummer 7'})).toBeVisible();

  await callsheet.toggleInterviewPhotos();
  await expect(callsheet.interviewPeople()).toHaveCount(0);
  await expect(page.getByText('Interview Anna de Vries').first()).toBeVisible();

  // Remembered on the device
  await page.reload();
  await expect(page.getByText('Interview Anna de Vries').first()).toBeVisible();
  await expect(callsheet.interviewPeople()).toHaveCount(0);
});
