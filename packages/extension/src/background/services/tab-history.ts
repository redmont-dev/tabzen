import type { MessageBus } from '../message-bus';
import { SessionStorage } from '@/data/storage';
import { TAB_HISTORY_KEY, MAX_TAB_HISTORY } from '@/shared/constants';

/**
 * Per-window most-recently-used tab history, newest first. Index 0 is the
 * currently active tab, so index 1 is "the previous tab".
 *
 * Stored in chrome.storage.session: the MV3 service worker is torn down every
 * ~30s of idle, so in-memory history would be gone before the user ever reached
 * for the shortcut. storage.session survives worker restarts and is cleared
 * when the browser closes, which is exactly the lifetime this should have.
 */
type TabHistory = Record<number, number[]>;

// All reads-modify-writes go through one chained promise. Tab activations can
// arrive faster than a storage round-trip, and concurrent read/modify/write
// would silently drop entries.
let writeQueue: Promise<void> = Promise.resolve();

function mutate(fn: (history: TabHistory) => TabHistory): Promise<void> {
  writeQueue = writeQueue
    .then(async () => {
      const history = await SessionStorage.get<TabHistory>(TAB_HISTORY_KEY, {});
      await SessionStorage.set(TAB_HISTORY_KEY, fn(history));
    })
    .catch(err => console.warn('Tab history update failed:', err));
  return writeQueue;
}

async function readHistory(): Promise<TabHistory> {
  // Wait for queued writes so a read never observes a stale list.
  await writeQueue;
  return SessionStorage.get<TabHistory>(TAB_HISTORY_KEY, {});
}

/** Record a tab activation at the front of its window's list. */
export function recordActivation(windowId: number, tabId: number): Promise<void> {
  return mutate(history => {
    const previous = history[windowId] ?? [];
    const next = [tabId, ...previous.filter(id => id !== tabId)].slice(0, MAX_TAB_HISTORY);
    return { ...history, [windowId]: next };
  });
}

/** Drop a tab from every window's list (closed, or moved to another window). */
export function forgetTab(tabId: number): Promise<void> {
  return mutate(history => {
    const next: TabHistory = {};
    for (const [windowId, tabIds] of Object.entries(history)) {
      next[Number(windowId)] = tabIds.filter(id => id !== tabId);
    }
    return next;
  });
}

export function forgetWindow(windowId: number): Promise<void> {
  return mutate(history => {
    const next = { ...history };
    delete next[windowId];
    return next;
  });
}

/**
 * Activate the most recent tab in this window other than the active one.
 *
 * The resulting activation is itself recorded, which puts the tab we came from
 * at index 1 — so pressing the shortcut again returns there. That is what makes
 * this an Alt-Tab style toggle rather than a one-way walk into the past.
 *
 * Returns false when there is nothing to go back to (a fresh window, or every
 * remembered tab has since been closed).
 */
export async function switchToPreviousTab(windowId: number): Promise<boolean> {
  const history = await readHistory();
  const candidates = history[windowId] ?? [];
  if (candidates.length === 0) return false;

  const [activeTab] = await chrome.tabs.query({ active: true, windowId });
  const stale: number[] = [];

  for (const tabId of candidates) {
    if (tabId === activeTab?.id) continue;

    let tab: chrome.tabs.Tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      stale.push(tabId); // Closed since we recorded it
      continue;
    }

    // Dragged into another window — it is no longer this window's history
    if (tab.windowId !== windowId) {
      stale.push(tabId);
      continue;
    }

    await chrome.tabs.update(tabId, { active: true });
    if (stale.length > 0) await pruneStale(windowId, stale);
    return true;
  }

  if (stale.length > 0) await pruneStale(windowId, stale);
  return false;
}

function pruneStale(windowId: number, stale: number[]): Promise<void> {
  const staleSet = new Set(stale);
  return mutate(history => {
    const tabIds = history[windowId];
    if (!tabIds) return history;
    return { ...history, [windowId]: tabIds.filter(id => !staleSet.has(id)) };
  });
}

/**
 * Seed each window's history with its currently active tab.
 *
 * Without this, the first switch after a service-worker restart has nothing to
 * go back to: onActivated would record only the tab being switched *to*, and
 * the tab the user came from was never seen. Existing history is left alone.
 */
export async function seedActiveTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true });
  await mutate(history => {
    const next = { ...history };
    for (const tab of tabs) {
      if (tab.id === undefined || tab.windowId === undefined) continue;
      if ((next[tab.windowId] ?? []).length > 0) continue;
      next[tab.windowId] = [tab.id];
    }
    return next;
  });
}

export function registerTabHistory(bus: MessageBus): void {
  bus.register('switchToPreviousTab', async (req) => {
    const switched = await switchToPreviousTab(req.windowId);
    return { ok: true, data: { switched } };
  });

  chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
    void recordActivation(windowId, tabId);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void forgetTab(tabId);
  });

  // A detached tab keeps its id in the new window; drop it from the old one and
  // let the next activation re-record it under the window it moved to.
  chrome.tabs.onDetached.addListener((tabId) => {
    void forgetTab(tabId);
  });

  chrome.windows.onRemoved.addListener((windowId) => {
    void forgetWindow(windowId);
  });

  seedActiveTabs().catch(err => console.warn('Tab history seed failed:', err));
}
