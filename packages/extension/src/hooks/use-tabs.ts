import { useState, useEffect, useCallback } from 'preact/hooks';
import { sendMessage } from './use-message';

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  pinned: boolean;
  active: boolean;
  groupId: number;
  index: number;
}

export interface GroupInfo {
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
  tabs: TabInfo[];
}

export interface WindowState {
  windowId: number;
  tabs: TabInfo[];
  groups: GroupInfo[];
  ungroupedTabs: TabInfo[];
  tabCount: number;
  groupCount: number;
}

function buildWindowState(
  windowId: number,
  rawTabs: chrome.tabs.Tab[],
  rawGroups: chrome.tabGroups.TabGroup[],
): WindowState {
  const tabs: TabInfo[] = rawTabs
    .filter(t => t.id != null)
    .map(t => ({
      id: t.id!,
      title: t.title ?? '',
      url: t.url ?? '',
      favIconUrl: t.favIconUrl ?? null,
      pinned: t.pinned ?? false,
      active: t.active ?? false,
      groupId: t.groupId ?? -1,
      index: t.index ?? 0,
    }))
    .sort((a, b) => a.index - b.index);

  const groupMap = new Map<number, GroupInfo>();
  for (const g of rawGroups) {
    groupMap.set(g.id, {
      id: g.id,
      title: g.title ?? '',
      color: g.color,
      collapsed: g.collapsed,
      tabs: [],
    });
  }

  const ungroupedTabs: TabInfo[] = [];

  for (const tab of tabs) {
    const group = groupMap.get(tab.groupId);
    if (group) {
      group.tabs.push(tab);
    } else {
      ungroupedTabs.push(tab);
    }
  }

  // Sort groups by the index of their first tab
  const groups = [...groupMap.values()].sort((a, b) => {
    const aFirst = a.tabs[0]?.index ?? Infinity;
    const bFirst = b.tabs[0]?.index ?? Infinity;
    return aFirst - bFirst;
  });

  return {
    windowId,
    tabs,
    groups,
    ungroupedTabs,
    tabCount: tabs.length,
    groupCount: groups.length,
  };
}

export function useTabs(): { state: WindowState | null; refresh: () => void; loading: boolean } {
  const [state, setState] = useState<WindowState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWindowInfo = useCallback(async () => {
    try {
      const window = await chrome.windows.getCurrent();
      if (!window.id) return;

      const response = await sendMessage<{ tabs: chrome.tabs.Tab[]; groups: chrome.tabGroups.TabGroup[] }>({
        action: 'getWindowInfo',
        windowId: window.id,
      });

      if (response.ok && response.data) {
        setState(buildWindowState(window.id, response.data.tabs, response.data.groups));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWindowInfo();

    // Connect long-lived port for real-time updates
    const port = chrome.runtime.connect({ name: 'tabzen-ui' });

    port.onMessage.addListener((message: {
      type: string;
      tabs: chrome.tabs.Tab[];
      groups: chrome.tabGroups.TabGroup[];
      windowId: number;
    }) => {
      if (message.type === 'windowUpdate') {
        setState(buildWindowState(message.windowId, message.tabs, message.groups));
      }
    });

    return () => {
      try { port.disconnect(); } catch { /* port already disconnected */ }
    };
  }, [fetchWindowInfo]);

  return { state, refresh: fetchWindowInfo, loading };
}
