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
  // Use chrome://extensions page to scrape the extension ID from the DOM
  const page = await browser.newPage();
  await page.goto('chrome://extensions');
  await wait(2000);

  // Enable developer mode and read the extension ID from the page
  const extensionId = await page.evaluate(async () => {
    // Access the extensions page's shadow DOM
    const manager = document.querySelector('extensions-manager');
    if (!manager?.shadowRoot) return null;

    const itemList = manager.shadowRoot.querySelector('extensions-item-list');
    if (!itemList?.shadowRoot) return null;

    const items = itemList.shadowRoot.querySelectorAll('extensions-item');
    for (const item of items) {
      const id = item.getAttribute('id');
      if (id) return id;
    }
    return null;
  });

  if (extensionId) {
    await page.close();
    return extensionId;
  }

  // Fallback: try to find it via service worker targets
  for (let attempt = 0; attempt < 5; attempt++) {
    const targets = browser.targets();
    for (const target of targets) {
      const url = target.url();
      if (url.includes('chrome-extension://')) {
        const match = url.match(/chrome-extension:\/\/([^/]+)/);
        if (match) {
          await page.close();
          return match[1];
        }
      }
    }
    await wait(1000);
  }

  // Last fallback: use waitForTarget which handles lazy service workers
  try {
    const target = await browser.waitForTarget(
      t => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
      { timeout: 10000 },
    );
    const match = target.url().match(/chrome-extension:\/\/([^/]+)/);
    if (match) {
      await page.close();
      return match[1];
    }
  } catch {
    // waitForTarget timed out
  }

  await page.close();
  throw new Error('Extension not found');
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
