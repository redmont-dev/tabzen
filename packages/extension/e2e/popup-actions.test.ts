import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Browser } from 'puppeteer';
import { launchBrowser, getExtensionId, openPopup, wait } from './helpers';

describe('Popup actions', () => {
  let browser: Browser;
  let extensionId: string;

  beforeAll(async () => {
    browser = await launchBrowser();
    extensionId = await getExtensionId(browser);
    // Open a few tabs for testing
    for (const url of ['https://example.com', 'https://example.org', 'https://example.net']) {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    await wait(1000);
  }, 30000);

  afterAll(async () => {
    await browser?.close();
  });

  it('shows tab and group counts', async () => {
    const page = await openPopup(browser, extensionId);
    await wait(500);
    const text = await page.evaluate(() => document.body.innerText);
    // Should show some tab count (at least the tabs we opened)
    expect(text).toMatch(/\d+ tabs/);
    await page.close();
  }, 10000);

  it('shows action sections', async () => {
    const page = await openPopup(browser, extensionId);
    await wait(500);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('Clean up');
    expect(text).toContain('Save session');
    expect(text).toContain('Sort tabs');
    expect(text).toContain('Sort groups');
    await page.close();
  }, 10000);

  it('save session creates a session', async () => {
    const page = await openPopup(browser, extensionId);
    await wait(500);

    // Click Save session
    const buttons = await page.$$('button');
    let saveButton = null;
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text?.includes('Save session')) {
        saveButton = btn;
        break;
      }
    }
    expect(saveButton).toBeTruthy();
    await saveButton!.click();
    await wait(1000);

    // Check that a toast appeared
    const toastText = await page.evaluate(() => {
      const toast = document.querySelector('[class*="toast"]');
      return toast?.textContent ?? '';
    });
    expect(toastText).toContain('Session saved');
    await page.close();
  }, 15000);
});
