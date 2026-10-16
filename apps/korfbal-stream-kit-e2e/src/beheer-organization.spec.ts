import {apiUrl, db, expect, test} from './support/fixtures';
import {OrganizationPage} from './support/pages';

/** Beheer → Organisatie: an API key is shown once, opens the vMix feeds, and stops working when revoked. */
const NAME = 'E2E vMix stream-pc';

test.afterEach(async () => {
  await db.organizationApiKey.deleteMany({where: {name: NAME}});
});

test('creates an API key for the vMix feeds and revokes it', async ({page, request, playwright}) => {
  const organization = new OrganizationPage(page);
  await organization.open();
  const {dialog, key} = await organization.createApiKey(NAME);
  expect(key).toMatch(/^sk_/);
  await expect(dialog).toContainText('Je ziet deze sleutel alleen nu');
  // The feed URLs, ready to copy with the key filled in
  await expect(dialog.getByText(new RegExp(`/api/vmix/sponsor-names\\?key=${key}`))).toBeVisible();
  await dialog.getByRole('button', {name: 'Klaar'}).click();
  await expect(page.getByText(key)).toHaveCount(0);
  await expect(organization.keyRow(NAME)).toContainText(key.slice(0, 9));

  // A device without X-Organization: only the key
  const device = await playwright.request.newContext();
  try {
    expect((await device.get(`${apiUrl}/api/vmix/sponsor-names`)).status()).toBe(401);
    expect((await device.get(`${apiUrl}/api/vmix/sponsor-names?key=${key}`)).status()).toBe(200);

    await organization.revoke(NAME);
    await expect(organization.keyRow(NAME)).toContainText('Ingetrokken');
    expect((await device.get(`${apiUrl}/api/vmix/sponsor-names?key=${key}`)).status()).toBe(401);
  } finally {
    await device.dispose();
  }
  // The browser's own calls still work with X-Organization
  expect((await request.get(`${apiUrl}/api/organization/api-keys`)).status()).toBe(200);
});
