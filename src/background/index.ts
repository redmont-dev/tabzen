import { MessageBus } from './message-bus';
import { registerTabManager } from './services/tab-manager';
import { registerRuleEngine, applyRules } from './services/rule-engine';
import { registerWorkspaceManager } from './services/workspace-manager';
import { registerSessionManager } from './services/session-manager';
import { registerSearchIndex } from './services/search-index';
import { registerAnalyticsCollector } from './services/analytics-collector';
import { initPortManager } from './ports';
import { SyncStorage } from '@/data/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants';
import type { Settings } from '@/data/types';

const bus = new MessageBus();

// RuleEngine must register before TabManager so applyRules is available for cleanUp
registerRuleEngine(bus);
registerTabManager(bus, applyRules);
registerWorkspaceManager(bus);
registerSessionManager(bus);
registerSearchIndex(bus);
registerAnalyticsCollector(bus);

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

console.log('Tabzen background service worker started');
