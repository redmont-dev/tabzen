import type { MessageBus } from '../message-bus';
import type { SortBy, SortOrder, Settings, Workspace, PriorityRule, GroupSortMode } from '@/data/types';
import { SyncStorage, LocalStorage } from '@/data/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS, TAB_GROUP_COLORS } from '@/shared/constants';
import { normalizeUrl } from '../utils/url-normalize';

async function getSettings(): Promise<Settings> {
  return SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

async function getActiveWorkspace(): Promise<Workspace | null> {
  const settings = await getSettings();
  const workspaces = await LocalStorage.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
  return workspaces.find(w => w.id === settings.activeWorkspaceId) ?? null;
}

function isPriorityTab(
  tab: chrome.tabs.Tab,
  groupColor: string | undefined,
  priorityRules: PriorityRule[],
): boolean {
  if (!tab.url) return false;
  for (const rule of priorityRules) {
    if (tab.url.startsWith(rule.urlPrefix)) {
      // If colors array is empty, matches all groups; otherwise group must match
      if (rule.colors.length === 0 || (groupColor && rule.colors.includes(groupColor as any))) {
        return true;
      }
    }
  }
  return false;
}

function compareTabs(
  a: chrome.tabs.Tab,
  b: chrome.tabs.Tab,
  sortBy: SortBy,
  sortOrder: SortOrder,
): number {
  const aVal = sortBy === 'title' ? (a.title ?? '') : (a.url ?? '');
  const bVal = sortBy === 'title' ? (b.title ?? '') : (b.url ?? '');
  const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
  return sortOrder === 'asc' ? cmp : -cmp;
}

async function sortTabs(
  windowId: number,
  sortBy: SortBy,
  sortOrder: SortOrder,
  groupId?: number,
): Promise<void> {
  const query: chrome.tabs.QueryInfo = groupId !== undefined
    ? { windowId, groupId }
    : { windowId };

  const tabs = await chrome.tabs.query(query);
  const unpinned = tabs.filter(t => !t.pinned);

  // Determine priority rules and group color
  const workspace = await getActiveWorkspace();
  const priorityRules = workspace?.priorityRules ?? [];
  let groupColor: string | undefined;

  if (groupId !== undefined && groupId !== -1 && priorityRules.length > 0) {
    const groups = await chrome.tabGroups.query({ windowId });
    const group = groups.find(g => g.id === groupId);
    groupColor = group?.color;
  }

  // Separate priority and normal tabs
  const priority: chrome.tabs.Tab[] = [];
  const normal: chrome.tabs.Tab[] = [];

  for (const tab of unpinned) {
    if (priorityRules.length > 0 && isPriorityTab(tab, groupColor, priorityRules)) {
      priority.push(tab);
    } else {
      normal.push(tab);
    }
  }

  // Sort each group independently
  priority.sort((a, b) => compareTabs(a, b, sortBy, sortOrder));
  normal.sort((a, b) => compareTabs(a, b, sortBy, sortOrder));

  const sorted = [...priority, ...normal];

  const startIndex = unpinned.length > 0
    ? Math.min(...unpinned.map(t => t.index))
    : 0;

  for (let i = 0; i < sorted.length; i++) {
    const tab = sorted[i];
    if (tab.id != null) {
      await chrome.tabs.move(tab.id, { index: startIndex + i });
    }
  }
}

async function removeDuplicates(windowId: number): Promise<number> {
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({ windowId });
  const seen = new Set<string>();
  const toClose: number[] = [];

  for (const tab of tabs) {
    if (!tab.url || !tab.id) continue;

    const normalized = normalizeUrl(tab.url, {
      stripFragments: settings.stripFragments,
      stripTrailingSlash: settings.stripTrailingSlash,
      protocolAgnostic: settings.protocolAgnostic,
    });

    if (seen.has(normalized)) {
      // Don't close pinned tabs — only close the duplicate if it's unpinned
      if (!tab.pinned) {
        toClose.push(tab.id);
      }
    } else {
      seen.add(normalized);
    }
  }

  for (const tabId of toClose) {
    await chrome.tabs.remove(tabId);
  }

  return toClose.length;
}

async function sortGroups(windowId: number, mode: GroupSortMode): Promise<void> {
  const groups = await chrome.tabGroups.query({ windowId });
  if (groups.length === 0) return;

  let sorted: chrome.tabGroups.TabGroup[];

  if (mode === 'name') {
    sorted = [...groups].sort((a, b) =>
      (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' })
    );
  } else {
    // Sort by color using user's custom color order
    const settings = await getSettings();
    const colorOrder = settings.colorOrder ?? TAB_GROUP_COLORS;
    sorted = [...groups].sort((a, b) => {
      const aIdx = colorOrder.indexOf(a.color as any);
      const bIdx = colorOrder.indexOf(b.color as any);
      return aIdx - bIdx;
    });
  }

  // Move each group's tabs in the sorted order. We find pinned tab count to know our starting index.
  const allTabs = await chrome.tabs.query({ windowId, pinned: true });
  let targetIndex = allTabs.length; // Start after pinned tabs

  for (const group of sorted) {
    const groupTabs = await chrome.tabs.query({ windowId, groupId: group.id });
    for (const tab of groupTabs) {
      if (tab.id != null) {
        await chrome.tabs.move(tab.id, { index: targetIndex });
        targetIndex++;
      }
    }
  }
}

async function collapseAllGroups(windowId: number): Promise<void> {
  const groups = await chrome.tabGroups.query({ windowId });
  for (const group of groups) {
    await chrome.tabGroups.update(group.id, { collapsed: true });
  }
}

async function cleanUp(windowId: number, applyRulesFn?: (windowId: number) => Promise<void>): Promise<void> {
  const settings = await getSettings();

  // Step 1: Remove duplicates
  if (settings.cleanupDedup) {
    await removeDuplicates(windowId);
  }

  // Step 2: Apply grouping rules (delegated to RuleEngine via callback)
  if (settings.cleanupGroup && applyRulesFn) {
    await applyRulesFn(windowId);
  }

  // Step 3: Sort tabs
  if (settings.cleanupSort) {
    await sortTabs(windowId, settings.defaultSortBy, settings.defaultSortOrder);
  }

  // Step 4: Sort groups
  if (settings.cleanupSortGroups) {
    await sortGroups(windowId, settings.groupSortMode);
  }

  // Step 5: Collapse all groups
  if (settings.cleanupCollapse) {
    await collapseAllGroups(windowId);
  }
}

export function registerTabManager(
  bus: MessageBus,
  applyRulesFn?: (windowId: number) => Promise<void>,
): void {
  bus.register('sortTabs', async (req) => {
    await sortTabs(req.windowId, req.sortBy, req.sortOrder, req.groupId);
    return { ok: true };
  });

  bus.register('removeDuplicates', async (req) => {
    const removed = await removeDuplicates(req.windowId);
    return { ok: true, data: { removed } };
  });

  bus.register('sortGroups', async (req) => {
    await sortGroups(req.windowId, req.mode);
    return { ok: true };
  });

  bus.register('collapseAll', async (req) => {
    await collapseAllGroups(req.windowId);
    return { ok: true };
  });

  bus.register('cleanUp', async (req) => {
    await cleanUp(req.windowId, applyRulesFn);
    return { ok: true };
  });

  bus.register('getWindowInfo', async (req) => {
    const [tabs, groups] = await Promise.all([
      chrome.tabs.query({ windowId: req.windowId }),
      chrome.tabGroups.query({ windowId: req.windowId }),
    ]);
    return { ok: true, data: { tabs, groups } };
  });
}
