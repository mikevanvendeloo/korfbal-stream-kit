import {apiUrl, db, ensureOrganization, expect, test} from './support/fixtures';

/** Beheer: the callsheet push follows one position, saved through the real API in the test database. */
const pushSettings = async (request: import('@playwright/test').APIRequestContext) =>
  (await request.get(`${apiUrl}/api/settings/vmix-callsheet-push`)).json();

test('chooses one position for the callsheet push', async ({page, request}) => {
  const previous = await pushSettings(request);
  const organizationId = await ensureOrganization(db);
  await db.position.upsert({where: {organizationId_name: {organizationId, name: 'E2E Analist'}}, update: {}, create: {organizationId, name: 'E2E Analist'}});
  try {
    await page.goto('/admin/stamgegevens/vmix-koppeling');
    const position = page.getByLabel('Positie', {exact: true});
    await expect(position).toBeVisible();
    // One choice from a list, no checkboxes
    await expect(page.getByRole('checkbox', {name: 'E2E Analist'})).toHaveCount(0);

    const save = page.getByRole('button', {name: 'Opslaan', exact: true}).last();
    await position.selectOption('E2E Analist');
    await save.click();
    await expect(page.getByText('Instellingen opgeslagen')).toBeVisible();
    expect((await pushSettings(request)).positions).toEqual(['E2E Analist']);

    // Kept after a reload
    await page.reload();
    await expect(page.getByLabel('Positie', {exact: true})).toHaveValue('E2E Analist');

    // "Alle items"
    await page.getByLabel('Positie', {exact: true}).selectOption('');
    await save.click();
    await expect.poll(async () => (await pushSettings(request)).positions).toEqual([]);
  } finally {
    await request.put(`${apiUrl}/api/settings/vmix-callsheet-push`, {data: previous});
    await db.position.deleteMany({where: {name: 'E2E Analist'}});
  }
});
