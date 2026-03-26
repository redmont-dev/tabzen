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
  // Open chrome://extensions to trigger extension initialization
  const extPage = await browser.newPage();
  await extPage.goto('chrome://extensions');
  await wait(2000);

  // Try multiple target types — MV3 service workers are ephemeral
  for (let attempt = 0; attempt < 15; attempt++) {
    const targets = browser.targets();
    for (const target of targets) {
      const url = target.url();
      if (url.includes('chrome-extension://') && !url.includes('chrome://extensions')) {
        const match = url.match(/chrome-extension:\/\/([^/]+)/);
        if (match) {
          await extPage.close();
          return match[1];
        }
      }
    }
    await wait(1000);
  }

  // Last resort: look at all pages for an extension page
  const pages = await browser.pages();
  for (const page of pages) {
    const url = page.url();
    const match = url.match(/chrome-extension:\/\/([^/]+)/);
    if (match) {
      await extPage.close();
      return match[1];
    }
  }

  await extPage.close();
  throw new Error('Extension not found after 15 attempts');
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
