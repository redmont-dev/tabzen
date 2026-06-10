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
import { normalizeUrl } from './utils/url-normalize';
import type { TabSearchResult } from './services/search-index';
import type { Settings } from '@/data/types';

const bus = new MessageBus();

// RuleEngine must register before TabManager so applyRules is available for cleanUp
registerRuleEngine(bus);
registerTabManager(bus, applyRules);
registerWorkspaceManager(bus, applyRules);
registerSearchIndex(bus);

// Handlers register synchronously and await DB readiness internally, so no
// message arriving early can hit a missing handler.
registerAnalyticsCollector(bus);

registerContextMenus(bus);
registerRulePacks(bus);

// DriveSync shares the SessionManager's DB instance
const sessionManager = registerSessionManager(bus);
registerDriveSync(bus, sessionManager.db, sessionManager.ready);

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

  // Reschedule the auto-save alarm whenever its settings change
  if ('autoSaveSchedule' in req.settings || 'autoSaveDailyTime' in req.settings) {
    const response = await bus.dispatch({ action: 'configureAutoSave' });
    if (!response.ok) console.warn('Failed to reconfigure auto-save:', response.error);
  }

  return { ok: true, data: merged };
});

// Initialize real-time port connections for UI
initPortManager();

// Omnibox: type "tabzen <query>" in address bar to search and switch to a tab
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  if (!text.trim()) return;

  const response = await bus.dispatch({ action: 'searchTabs', query: text, scope: 'tabs' });
  if (!response.ok || !response.data) return;

  const results = (response.data as TabSearchResult[]).filter(r => r.kind === 'tab');

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
    if (response.ok && response.data && Array.isArray(response.data) && response.data.length > 0) {
      const best = (response.data as TabSearchResult[]).filter(r => r.kind === 'tab')[0];
      if (!best) return;
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
  const window = await chrome.windows.getLastFocused();
  if (!window.id) return;

  switch (command) {
    case 'clean-up':
      await bus.dispatch({ action: 'cleanUp', windowId: window.id });
      break;
    case 'search':
      // Commands count as a user gesture, so the panel can be opened directly.
      // The side panel auto-focuses its search bar on mount.
      await chrome.sidePanel.open({ windowId: window.id });
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
const MAX_PENDING_LINK_TABS = 100;
const pendingLinkTabs = new Map<number, number>(); // tabId -> timestamp

chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  // Cap the map size to prevent unbounded growth
  if (pendingLinkTabs.size >= MAX_PENDING_LINK_TABS) {
    // Remove oldest entries
    const entries = [...pendingLinkTabs.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, Math.floor(MAX_PENDING_LINK_TABS / 2));
    for (const [tabId] of toRemove) {
      pendingLinkTabs.delete(tabId);
    }
  }
  pendingLinkTabs.set(details.tabId, Date.now());
  // Safety cleanup for tabs that never finish loading
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
      // Duplicate found — replace the original with the newly loaded tab.
      // If the original was pinned, fall back to keeping it (don't kill pinned).
      try {
        if (existing.pinned) {
          await chrome.tabs.remove(tabId);
          await chrome.tabs.update(existing.id, { active: true });
        } else {
          const targetGroupId = existing.groupId;
          await chrome.tabs.remove(existing.id);
          // Preserve grouping: move the new tab into the original's group.
          if (tab.id != null && targetGroupId != null && targetGroupId !== -1) {
            try {
              await chrome.tabs.group({ tabIds: tab.id, groupId: targetGroupId });
            } catch {
              // Group may have been removed when the last member was closed
            }
          }
        }

        bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'duplicatesBlocked' }).catch(err => console.warn('Analytics increment failed:', err));
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

if (import.meta.env.DEV) console.log('Tabzen background service worker started');
