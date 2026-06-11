import Fuse from 'fuse.js';
import type { MessageBus } from '../message-bus';
import type { Session } from '@/data/types';

export interface TabSearchResult {
  kind: 'tab';
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  groupName: string | null;
  groupColor: string | null;
}

export interface SessionSearchResult {
  kind: 'session';
  sessionId: string;
  name: string;
  tabCount: number;
  createdAt: number;
}

export type SearchResult = TabSearchResult | SessionSearchResult;

const MAX_RESULTS = 20;
const MAX_SESSION_RESULTS = 10;

async function searchTabs(query: string): Promise<TabSearchResult[]> {
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
      kind: 'tab' as const,
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

async function searchSessions(bus: MessageBus, query: string): Promise<SessionSearchResult[]> {
  if (!query.trim()) return [];

  const response = await bus.dispatch({ action: 'getSessions' });
  if (!response.ok || !Array.isArray(response.data)) return [];
  const sessions = response.data as Session[];

  const fuse = new Fuse(sessions, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'tabs.title', weight: 0.3 },
      { name: 'tabs.url', weight: 0.2 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    includeScore: true,
  });

  return fuse.search(query, { limit: MAX_SESSION_RESULTS }).map(r => ({
    kind: 'session' as const,
    sessionId: r.item.id,
    name: r.item.name,
    tabCount: r.item.tabs.length,
    createdAt: r.item.createdAt,
  }));
}

export function registerSearchIndex(bus: MessageBus): void {
  bus.register('searchTabs', async (req) => {
    const results: SearchResult[] = [];
    if (req.scope === 'tabs' || req.scope === 'all') {
      results.push(...await searchTabs(req.query));
    }
    if (req.scope === 'sessions' || req.scope === 'all') {
      results.push(...await searchSessions(bus, req.query));
    }
    return { ok: true, data: results };
  });
}
