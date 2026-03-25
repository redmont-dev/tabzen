import { MessageBus } from './message-bus';
import { registerTabManager } from './services/tab-manager';
import { registerRuleEngine, applyRules } from './services/rule-engine';
import { registerWorkspaceManager } from './services/workspace-manager';
import { registerSessionManager } from './services/session-manager';
import { registerDriveSync } from './services/drive-sync';
import { registerSearchIndex } from './services/search-index';
import { registerAnalyticsCollector } from './services/analytics-collector';
import { registerContextMenus } from './services/context-menus';
import { registerRulePacks } from './services/rule-packs';
import { initPortManager } from './ports';
import { SyncStorage } from '@/data/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants';
import type { Settings } from '@/data/types';

const bus = new MessageBus();

// RuleEngine must register before TabManager so applyRules is available for cleanUp
registerRuleEngine(bus);
registerTabManager(bus, applyRules);
registerWorkspaceManager(bus, applyRules);
registerSearchIndex(bus);

// AnalyticsCollector is async (opens IndexedDB), so we initialize it separately
registerAnalyticsCollector(bus).catch(err => {
  console.error('Failed to initialize AnalyticsCollector:', err);
});

registerContextMenus(bus);
registerRulePacks(bus);

// SessionManager is async (opens IndexedDB), so we initialize it separately
// DriveSync shares the same DB instance
registerSessionManager(bus).then(db => {
  return registerDriveSync(bus, db);
}).catch(err => {
  console.error('Failed to initialize SessionManager/DriveSync:', err);
});

bus.listen();
bus.register('ping', async () => ({ ok: true, data: 'pong' }));

bus.register('getSettings', async () => {
  const settings = await SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  return { ok: true, data: settings };
});

bus.register('updateSettings', async (req) => {
  const current = await SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  const merged = { ...current, ...req.settings };
  await SyncStorage.set(STORAGE_KEYS.SETTINGS, merged);
  return { ok: true, data: merged };
});

// Initialize real-time port connections for UI
initPortManager();

// Omnibox: type "tabzen <query>" in address bar to search and switch to a tab
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  if (!text.trim()) return;

  const response = await bus.dispatch({ action: 'searchTabs', query: text, scope: 'tabs' });
  if (!response.ok || !response.data) return;

  const results = response.data as Array<{
    tabId: number;
    title: string;
    url: string;
    groupName: string | null;
    groupColor: string | null;
  }>;

  const suggestions = results.slice(0, 6).map(r => ({
    content: String(r.tabId),
    description: r.groupName
      ? `[${r.groupName}] ${escapeXml(r.title)} — ${escapeXml(r.url)}`
      : `${escapeXml(r.title)} — ${escapeXml(r.url)}`,
  }));

  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const tabId = parseInt(text, 10);
  if (!isNaN(tabId)) {
    // User selected a suggestion — switch to that tab
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
      // Tab may have been closed
    }
  } else {
    // User pressed Enter on raw text — search and switch to best match
    const response = await bus.dispatch({ action: 'searchTabs', query: text, scope: 'tabs' });
    if (response.ok && response.data && (response.data as unknown[]).length > 0) {
      const best = (response.data as Array<{ tabId: number; windowId: number }>)[0];
      try {
        await chrome.tabs.update(best.tabId, { active: true });
        await chrome.windows.update(best.windowId, { focused: true });
      } catch {
        // Tab may have been closed
      }
    }
  }
});

// Global keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  const window = await chrome.windows.getCurrent();
  if (!window.id) return;

  switch (command) {
    case 'clean-up':
      await bus.dispatch({ action: 'cleanUp', windowId: window.id });
      break;
    case 'search':
      // Open the side panel so search is visible
      await chrome.sidePanel.setOptions({ enabled: true });
      // The side panel will auto-focus the search bar on open
      break;
    case 'save-session':
      await bus.dispatch({ action: 'saveSession', windowId: window.id });
      break;
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Auto Duplicate Detection ---
// Track tabs opened via link clicks (within a 10-second window)
const pendingLinkTabs = new Map<number, number>(); // tabId -> timestamp

chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  pendingLinkTabs.set(details.tabId, Date.now());
  // Clean up after 10 seconds
  setTimeout(() => pendingLinkTabs.delete(details.tabId), 10_000);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check tabs that were opened via link clicks and have finished loading
  if (changeInfo.status !== 'complete') return;
  if (!pendingLinkTabs.has(tabId)) return;
  if (!tab.url || !tab.windowId) return;

  // Remove from pending — we only check once
  pendingLinkTabs.delete(tabId);

  const settings = await SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  if (!settings.dedupEnabled) return;

  // Skip non-http URLs
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) return;

  const { normalizeUrl } = await import('./utils/url-normalize');
  const normalizedNew = normalizeUrl(tab.url, {
    stripFragments: settings.stripFragments,
    stripTrailingSlash: settings.stripTrailingSlash,
    protocolAgnostic: settings.protocolAgnostic,
  });

  // Find an existing tab with the same normalized URL
  const allTabs = await chrome.tabs.query({ windowId: tab.windowId });
  for (const existing of allTabs) {
    if (existing.id === tabId) continue; // Skip self
    if (!existing.url || !existing.id) continue;

    const normalizedExisting = normalizeUrl(existing.url, {
      stripFragments: settings.stripFragments,
      stripTrailingSlash: settings.stripTrailingSlash,
      protocolAgnostic: settings.protocolAgnostic,
    });

    if (normalizedNew === normalizedExisting) {
      // Duplicate found — close the new tab and switch to the existing one
      try {
        await chrome.tabs.remove(tabId);
        await chrome.tabs.update(existing.id, { active: true });

        // Increment analytics counter
        bus.dispatch({ action: 'incrementAnalyticsCounter', counter: 'duplicatesBlocked' }).catch(() => {});
      } catch {
        // Tab may have already been closed
      }
      return;
    }
  }
});

// --- Adaptive icon: swap between light and dark icons based on system theme ---
function updateIcon(isDark: boolean) {
  const suffix = isDark ? '-dark' : '';
  chrome.action.setIcon({
    path: {
      16: `icons/icon-16${suffix}.png`,
      32: `icons/icon-32${suffix}.png`,
      48: `icons/icon-48${suffix}.png`,
      128: `icons/icon-128${suffix}.png`,
    },
  });
}

// MV3 service workers support matchMedia
if (typeof matchMedia !== 'undefined') {
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  updateIcon(darkQuery.matches);
  darkQuery.addEventListener('change', (e) => updateIcon(e.matches));
}

console.log('Tabzen background service worker started');
