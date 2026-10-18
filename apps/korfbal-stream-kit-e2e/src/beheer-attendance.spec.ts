import {expect, test} from './support/fixtures';
import {AttendancePage} from './support/pages';

/**
 * Beschikbaarheid: people per group (Crew/Entertainment), and the minimum staffing that turns green
 * once a regisseur and three cameras are present. Someone with Regie and Camera counts only once.
 */
const P = 'E2E Bez';

test('marking people present until the minimum staffing is reached', async ({page, makeShow}) => {
  const show = await makeShow({
    active: false,
    // Only used when the test organization lacks a skill: the position made for it gets this category
    skillCategories: {COMMENTAAR: 'ENTERTAINMENT'},
    crew: [
      {name: `${P} Anouk`, skills: ['REGISSEUR', 'CAMERA_ZOOM']},
      {name: `${P} bram`, skills: ['CAMERA_ZOOM']},
      {name: `${P} Ćees`, skills: ['CAMERA_OVERVIEW']},
      {name: `${P} Dirk`, skills: ['CAMERA_ZOOM']},
      {name: `${P} Eva`, skills: ['COMMENTAAR']},
      {name: `${P} Zonder skills`},
    ],
  });
  const attendance = new AttendancePage(page);
  await attendance.open(show.productionId);

  // Two groups, alphabetical ignoring case and accents
  const crew = (await attendance.namesIn('Crew')).filter((n) => n.startsWith(P));
  expect(crew).toEqual([`${P} Anouk`, `${P} bram`, `${P} Ćees`, `${P} Dirk`, `${P} Zonder skills`]);
  expect((await attendance.namesIn('Entertainment')).filter((n) => n.startsWith(P))).toEqual([`${P} Eva`]);

  await expect(attendance.summary()).toHaveText("Minimale bezetting nog niet gehaald: nog 1 regisseur en 3 camera's");

  // The all-rounder fills Regie, not also a camera
  await attendance.markPresent(`${P} Anouk`);
  await expect(attendance.summary()).toHaveText("Minimale bezetting nog niet gehaald: nog 3 camera's");
  await attendance.markPresent(`${P} bram`);
  await attendance.markPresent(`${P} Ćees`);
  await expect(attendance.summary()).toHaveText('Minimale bezetting nog niet gehaald: nog 1 camera');
  await expect(attendance.role('camera')).toContainText('Camera 2/3');

  // Optional roles never hold the minimum back
  await expect(attendance.role('commentaar')).toContainText('Commentaar 0/1 (optioneel)');

  await attendance.markPresent(`${P} Dirk`);
  await expect(attendance.summary()).toHaveText('Minimale bezetting gehaald');
  await expect(attendance.role('regisseur')).toContainText('Regisseur 1/1');
  await expect(attendance.role('camera')).toContainText('Camera 3/3');

  await attendance.markPresent(`${P} Eva`);
  await expect(attendance.role('commentaar')).toContainText('Commentaar 1/1');
});
