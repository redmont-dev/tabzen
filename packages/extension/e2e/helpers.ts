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
  // Retry up to 10 times with 1s delay — service worker may take a moment to start
  for (let attempt = 0; attempt < 10; attempt++) {
    const targets = browser.targets();
    const target = targets.find(
      t => t.type() === 'service_worker' && t.url().includes('chrome-extension://')
    );
    if (target) {
      const match = target.url().match(/chrome-extension:\/\/([^/]+)/);
      if (match) return match[1];
    }
    await wait(1000);
  }
  throw new Error('Extension service worker not found after 10 attempts');
}

async function openPage(browser: Browser, extensionId: string, path: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/${path}`, { waitUntil: 'networkidle0' });
  // Wait for Preact to render (the app div should have children)
  await page.waitForFunction(
    () => {
      const app = document.getElementById('app');
      return app && app.children.length > 0;
    },
    { timeout: 5000 },
  );
  return page;
}

export async function openPopup(browser: Browser, extensionId: string): Promise<Page> {
  return openPage(browser, extensionId, 'popup.html');
}

export async function openSidePanel(browser: Browser, extensionId: string): Promise<Page> {
  return openPage(browser, extensionId, 'sidepanel.html');
}

export async function openNewTab(browser: Browser, extensionId: string): Promise<Page> {
  return openPage(browser, extensionId, 'newtab.html');
}

export async function openOptions(browser: Browser, extensionId: string): Promise<Page> {
  return openPage(browser, extensionId, 'options.html');
}

export function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
