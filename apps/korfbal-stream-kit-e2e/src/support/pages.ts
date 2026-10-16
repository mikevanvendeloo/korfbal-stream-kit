import {expect, Locator, Page} from '@playwright/test';

/**
 * Page objects: how the tests find and use the screens. When a label or button changes, change it here
 * and every test follows.
 */

/** Width of the page in CSS pixels; wider than the viewport means the page scrolls sideways. */
export const pageWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

/** "04:32" or "-00:12" → seconds (sign dropped). */
const seconds = (text: string | null) => {
  const [m, s] = (text ?? '').replace(/[^\d:]/g, '').split(':').map(Number);
  return m * 60 + s;
};

/** Confirms the next browser dialog (stop, restart, reset ask first). */
const confirmNextDialog = (page: Page) => page.once('dialog', (dialog) => dialog.accept());

export class LiveNav {
  constructor(private readonly page: Page) {}

  /** On a phone the LIVE screens are behind the menu button. */
  async open(screen: 'Actieve productie' | 'Scoreboard' | 'Callsheet' | 'Show Caller' | 'vMix') {
    await this.page.getByRole('button', {name: 'Menu openen'}).click();
    await this.page.getByRole('navigation', {name: 'LIVE'}).getByRole('link', {name: screen}).click();
  }

  help() {
    return this.page.getByRole('link', {name: 'Handleiding bij dit scherm'});
  }

  /** On a phone the organization switch is in the menu too. */
  async switchOrganization(current: string) {
    await this.page.getByRole('button', {name: 'Menu openen'}).click();
    await organizationSwitch(this.page, current).click();
  }
}

/** The chosen organization in the nav (LIVE and Beheer); a click opens the start screen. */
export const organizationSwitch = (page: Page, name: string) =>
  page.getByRole('button', {name: `Wissel organisatie (nu ${name})`});

/** The start screen: a large button per active organization. */
export class StartScreen {
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {name: 'Kies een organisatie'});
  }

  button(name: string) {
    return this.page.getByRole('list', {name: 'Organisaties'}).getByRole('button', {name: new RegExp(`^${name}`)});
  }

  async choose(name: string) {
    await expect(this.heading).toBeVisible();
    await this.button(name).click();
    await expect(this.heading).toBeHidden();
  }
}

/** The Show Caller on a phone (below 768 px). */
export class ShowCallerPhone {
  readonly now: Locator;
  readonly next: Locator;
  readonly later: Locator;
  readonly controls: Locator;

  constructor(private readonly page: Page) {
    this.now = page.getByRole('region', {name: 'Nu'});
    this.next = page.getByRole('region', {name: 'Volgende'});
    this.later = page.getByRole('region', {name: 'Daarna'});
    this.controls = page.getByRole('navigation', {name: 'Show bediening'});
  }

  async open(productionId: number, position = 'all') {
    await this.page.goto(`/show-caller/${productionId}/${position}`);
    await expect(this.controls).toBeVisible();
  }

  start = () => this.controls.getByRole('button', {name: 'Start show'}).click();
  nextItem = () => this.controls.getByRole('button', {name: 'Volgend item'}).click();
  previousItem = () => this.controls.getByRole('button', {name: 'Vorig item'}).click();
  setRemaining = (sec: 15 | 30 | 60) => this.now.getByRole('button', {name: `Resterend ${sec} seconden`}).click();

  async stop() {
    confirmNextDialog(this.page);
    await this.controls.getByRole('button', {name: 'Einde show'}).click();
  }

  async remainingSeconds() {
    return seconds(await this.now.getByLabel('Resterend', {exact: true}).textContent());
  }

  /** The show is on and this item is the current one. */
  async expectNow(title: string) {
    await expect(this.now).toContainText(title);
  }

  async expectNotStarted() {
    await expect(this.now).toContainText('De show is nog niet gestart');
  }
}

/** The Show Caller on a laptop or large screen. */
export class ShowCallerWide {
  constructor(private readonly page: Page) {}

  async open(productionId: number, position = 'all') {
    await this.page.goto(`/show-caller/${productionId}/${position}`);
    await expect(this.page.getByText('Stream draaiboek')).toBeVisible();
  }

  start = () => this.page.getByTitle('Start Show').click();
  nextItem = () => this.page.getByTitle('Volgend item').click();
  setRemaining = (sec: 15 | 30 | 60) =>
    this.page.getByRole('group', {name: 'Resterend instellen'}).getByRole('button', {name: `Resterend ${sec} seconden`}).click();

  async stop() {
    confirmNextDialog(this.page);
    await this.page.getByRole('button', {name: 'Einde show'}).click();
  }

  async remainingSeconds() {
    return seconds(await this.page.getByText('Resterend', {exact: true}).locator('xpath=..').textContent());
  }

  async expectRunning() {
    await expect(this.page.getByTitle('Herstart Show')).toBeVisible();
  }

  async expectStopped() {
    await expect(this.page.getByTitle('Start Show')).toBeVisible();
  }
}

/** Beheer → Overig → Organisatie: match import and API keys of the chosen organization. */
export class OrganizationPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/admin/overig/organisatie');
    await expect(this.page.getByRole('heading', {name: /^Organisatie/, level: 1})).toBeVisible();
  }

  /** Creates a key; returns the full key from the one-time dialog (left open). */
  async createApiKey(name: string) {
    await this.page.getByLabel('Naam van de sleutel').fill(name);
    await this.page.getByRole('button', {name: 'Sleutel aanmaken'}).click();
    const dialog = this.page.getByRole('dialog', {name: `API-sleutel ${name} aangemaakt`});
    await expect(dialog).toBeVisible();
    return {dialog, key: (await dialog.getByLabel('Nieuwe API-sleutel').textContent()) ?? ''};
  }

  keyRow(name: string) {
    return this.page.getByRole('table', {name: 'API-sleutels'}).getByRole('row').filter({hasText: name});
  }

  async revoke(name: string) {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.keyRow(name).getByRole('button', {name: `Sleutel ${name} intrekken`}).click();
  }
}
