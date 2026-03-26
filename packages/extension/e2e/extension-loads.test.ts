import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Browser } from 'puppeteer';
import { launchBrowser, getExtensionId, openPopup, openSidePanel, openNewTab, openOptions, wait } from './helpers';

describe('Extension loads', () => {
  let browser: Browser;
  let extensionId: string;

  beforeAll(async () => {
    browser = await launchBrowser();
    extensionId = await getExtensionId(browser);
  }, 30000);

  afterAll(async () => {
    await browser?.close();
  });

  it('has a valid extension ID', () => {
    expect(extensionId).toBeTruthy();
    expect(extensionId.length).toBeGreaterThan(10);
  });

  it('opens the popup', async () => {
    const page = await openPopup(browser, extensionId);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('Tabzen');
    await page.close();
  }, 10000);

  it('opens the side panel', async () => {
    const page = await openSidePanel(browser, extensionId);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('Tabzen');
    await page.close();
  }, 10000);

  it('opens the new tab page', async () => {
    const page = await openNewTab(browser, extensionId);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('Tabzen');
    await page.close();
  }, 10000);

  it('opens the options page', async () => {
    const page = await openOptions(browser, extensionId);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('Tabzen');
    await page.close();
  }, 10000);
});
