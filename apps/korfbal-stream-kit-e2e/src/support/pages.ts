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
