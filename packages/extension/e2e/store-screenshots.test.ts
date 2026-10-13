import { describe, it, beforeAll, afterAll } from 'vitest';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import { getExtensionId, wait } from './helpers';

// Generates the 1280x800 Chrome Web Store screenshots into docs/store-assets/.
// Opt-in (slow, opens a visible browser): SCREENSHOTS=1 pnpm test:e2e store-screenshots
const ENABLED = process.env.SCREENSHOTS === '1';

const EXTENSION_PATH = resolve(__dirname, '../dist');
const OUT_DIR = resolve(__dirname, '../../../docs/store-assets');
const WIDTH = 1280;
const HEIGHT = 800;

const SEED_TABS = [
  { url: 'https://github.com/preactjs/preact', group: 'Dev' },
  { url: 'https://github.com/vitest-dev/vitest', group: 'Dev' },
  { url: 'https://developer.mozilla.org/en-US/docs/Web/API', group: 'Docs' },
  { url: 'https://developer.chrome.com/docs/extensions', group: 'Docs' },
  { url: 'https://news.ycombinator.com', group: 'News' },
  { url: 'https://www.wikipedia.org', group: null },
];

const GROUP_COLORS: Record<string, string> = { Dev: 'blue', Docs: 'green', News: 'orange' };

describe.skipIf(!ENABLED)('store screenshots', () => {
  let browser: Browser;
  let extensionId: string;

  beforeAll(async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
        `--window-size=${WIDTH + 20},${HEIGHT + 120}`,
      ],
    });
    extensionId = await getExtensionId(browser);
  }, 60000);

  afterAll(async () => {
    await browser?.close();
  });

  async function openExtensionPage(path: string, width = WIDTH, height = HEIGHT): Promise<Page> {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`chrome-extension://${extensionId}/${path}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => {
      const app = document.getElementById('app');
      return app && app.children.length > 0;
    }, { timeout: 10000 });
    return page;
  }

  // Render a narrow surface's screenshot centered on a 1280x800 canvas
  async function composite(pngBase64: string, outFile: string, label: string): Promise<void> {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(`
      <style>
        body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; display: flex;
               align-items: center; justify-content: center;
               background: linear-gradient(135deg, #11131a 0%, #1c2030 100%); }
        img { max-height: ${HEIGHT - 80}px; border-radius: 12px;
              box-shadow: 0 24px 80px rgba(0,0,0,0.55); }
      </style>
      <img alt="${label}" src="data:image/png;base64,${pngBase64}">
    `);
    await wait(300);
    await page.screenshot({ path: resolve(OUT_DIR, outFile) as `${string}.png` });
    await page.close();
  }

  it('captures all store screenshots', async () => {
    // --- Seed: real tabs, groups, a saved session, analytics counters ---
    const seeder = await openExtensionPage('newtab.html');
    await seeder.evaluate(async (tabs, colors) => {
      const created: Record<string, number[]> = {};
      for (const t of tabs) {
        const tab = await chrome.tabs.create({ url: t.url, active: false });
        if (t.group && tab.id !== undefined) {
          (created[t.group] ??= []).push(tab.id);
        }
      }
      for (const [name, ids] of Object.entries(created)) {
        const groupId = await chrome.tabs.group({ tabIds: ids as [number, ...number[]] });
        await chrome.tabGroups.update(groupId, {
          title: name,
          color: colors[name] as chrome.tabGroups.TabGroup['color'],
        });
      }
    }, SEED_TABS, GROUP_COLORS);

    await wait(6000); // let pages load so tab titles/favicons are real

    await seeder.evaluate(async () => {
      const send = (msg: unknown) => chrome.runtime.sendMessage(msg);
      // Grouping rules so the options page has content
      const ws = await send({ action: 'getActiveWorkspace' });
      const rules = [
        { type: 'domain', pattern: 'github.com', groupName: 'Dev', color: 'blue' },
        { type: 'domain', pattern: 'developer.mozilla.org', groupName: 'Docs', color: 'green' },
        { type: 'domain', pattern: 'news.ycombinator.com', groupName: 'News', color: 'orange' },
        { type: 'prefix', pattern: 'https://developer.chrome.com/docs', groupName: 'Docs', color: 'green' },
      ].map((r, i) => ({ ...r, id: `seed-${i}`, enabled: true, source: 'user' }));
      await send({ action: 'updateWorkspace', workspaceId: ws.data.id, updates: { rules } });
      // A saved session + analytics so the dashboard has numbers
      const win = await chrome.windows.getCurrent();
      await send({ action: 'saveSession', windowId: win.id, name: 'Deep work — Tuesday' });
      await send({ action: 'incrementAnalyticsCounter', metric: 'duplicatesBlocked', amount: 12 });
      await send({ action: 'incrementAnalyticsCounter', metric: 'sessionsUsed', amount: 4 });
      await send({ action: 'incrementAnalyticsCounter', metric: 'tabsOpened', amount: 57 });
      await send({ action: 'takeAnalyticsSnapshot' });
    });
    await seeder.close();

    // --- 1. New tab dashboard ---
    const newtab = await openExtensionPage('newtab.html');
    await wait(1500);
    await newtab.screenshot({ path: resolve(OUT_DIR, '1-newtab-dashboard.png') as `${string}.png` });
    await newtab.close();

    // --- 2. Options: grouping rules ---
    const options = await openExtensionPage('options.html');
    await options.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.find(b => b.textContent?.trim() === 'Grouping Rules')?.click();
    });
    await wait(800);
    await options.screenshot({ path: resolve(OUT_DIR, '2-options-grouping-rules.png') as `${string}.png` });
    await options.close();

    // --- 3. Side panel (natural width, composited to 1280x800) ---
    const sidepanel = await openExtensionPage('sidepanel.html', 400, 720);
    await wait(1500);
    const sidepanelShot = await sidepanel.screenshot({ encoding: 'base64' });
    await sidepanel.close();
    await composite(sidepanelShot, '3-sidepanel-tab-tree.png', 'Tabzen side panel');

    // --- 4. Popup (natural width, composited to 1280x800) ---
    const popup = await openExtensionPage('popup.html', 380, 600);
    await wait(1500);
    const popupShot = await popup.screenshot({ encoding: 'base64' });
    await popup.close();
    await composite(popupShot, '4-popup-quick-actions.png', 'Tabzen popup');
  }, 120000);
});
