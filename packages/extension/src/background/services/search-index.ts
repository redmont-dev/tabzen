import Fuse from 'fuse.js';
import type { MessageBus } from '../message-bus';

export interface SearchResult {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  groupName: string | null;
  groupColor: string | null;
}

const MAX_RESULTS = 20;

async function searchTabs(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const tabs = await chrome.tabs.query({});

  // Build group lookup across all windows
  const windowIds = [...new Set(tabs.map(t => t.windowId))];
  const groupMap = new Map<number, chrome.tabGroups.TabGroup>();

  for (const wid of windowIds) {
    const groups = await chrome.tabGroups.query({ windowId: wid });
    for (const g of groups) {
      groupMap.set(g.id, g);
    }
  }

  // Build searchable items
  const items = tabs
    .filter(t => t.id != null && t.url)
    .map(t => ({
      tabId: t.id!,
      windowId: t.windowId,
      title: t.title ?? '',
      url: t.url!,
      favIconUrl: t.favIconUrl ?? null,
      groupId: t.groupId ?? -1,
    }));

  const fuse = new Fuse(items, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'url', weight: 0.4 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    includeScore: true,
  });

  const results = fuse.search(query, { limit: MAX_RESULTS });

  return results.map(r => {
    const item = r.item;
    const group = item.groupId !== -1 ? groupMap.get(item.groupId) : undefined;

    return {
      tabId: item.tabId,
      windowId: item.windowId,
      title: item.title,
      url: item.url,
      favIconUrl: item.favIconUrl,
      groupName: group?.title ?? null,
      groupColor: group?.color ?? null,
    };
  });
}

export function registerSearchIndex(bus: MessageBus): void {
  bus.register('searchTabs', async (req) => {
    // For now, only 'tabs' scope is implemented. Sessions scope comes in Plan 4.
    const results = await searchTabs(req.query);
    return { ok: true, data: results };
  });
}
