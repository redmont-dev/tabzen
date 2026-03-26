import puppeteer, { Browser, Page } from 'puppeteer';
import { resolve } from 'path';

const EXTENSION_PATH = resolve(__dirname, '../dist');

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: false, // Extensions require non-headless
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--start-minimized',
      // Required for CI (GitHub Actions runs as root in a container)
      ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
    ],
  });
}

export async function getExtensionId(browser: Browser): Promise<string> {
  // Navigate to chrome://extensions to find the extension ID
  const page = await browser.newPage();
  await page.goto('chrome://extensions');

  // The extension ID can be found via the service worker target
  const targets = browser.targets();
  const extensionTarget = targets.find(
    t => t.type() === 'service_worker' && t.url().includes('chrome-extension://')
  );

  if (!extensionTarget) {
    // Wait a moment for the extension to load
    await new Promise(r => setTimeout(r, 2000));
    const retryTargets = browser.targets();
    const retryTarget = retryTargets.find(
      t => t.type() === 'service_worker' && t.url().includes('chrome-extension://')
    );
    if (!retryTarget) throw new Error('Extension not found');
    const match = retryTarget.url().match(/chrome-extension:\/\/([^/]+)/);
    await page.close();
    return match![1];
  }

  const match = extensionTarget.url().match(/chrome-extension:\/\/([^/]+)/);
  await page.close();
  return match![1];
}

export async function openPopup(browser: Browser, extensionId: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForSelector('body');
  return page;
}

export async function openSidePanel(browser: Browser, extensionId: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.waitForSelector('body');
  return page;
}

export async function openNewTab(browser: Browser, extensionId: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/newtab.html`);
  await page.waitForSelector('body');
  return page;
}

export async function openOptions(browser: Browser, extensionId: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForSelector('body');
  return page;
}

export function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
