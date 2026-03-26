import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Browser } from 'puppeteer';
import { launchBrowser, getExtensionId, openOptions, openPopup, wait } from './helpers';

describe('Tab grouping', () => {
  let browser: Browser;
  let extensionId: string;

  beforeAll(async () => {
    browser = await launchBrowser();
    extensionId = await getExtensionId(browser);
  }, 30000);

  afterAll(async () => {
    await browser?.close();
  });

  it('options page shows grouping rules section', async () => {
    const page = await openOptions(browser, extensionId);
    await wait(500);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('Grouping');
    await page.close();
  }, 10000);

  it('new tab page shows stats', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await wait(1000);
    const text = await page.evaluate(() => document.body.innerText);
    // Should show some stats (tabs open, dupes blocked, sessions saved)
    expect(text).toMatch(/tabs open|dupes blocked|sessions saved/i);
    await page.close();
  }, 10000);
});
