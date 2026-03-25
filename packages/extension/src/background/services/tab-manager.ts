import type { MessageBus } from '../message-bus';
import type { SortBy, SortOrder, Settings, Workspace, PriorityRule, GroupSortMode } from '@/data/types';
import { SyncStorage } from '@/data/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS, TAB_GROUP_COLORS } from '@/shared/constants';
import { normalizeUrl } from '../utils/url-normalize';

async function getSettings(): Promise<Settings> {
  return SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

async function getActiveWorkspace(): Promise<Workspace | null> {
  const settings = await getSettings();
  const workspaces = await SyncStorage.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
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

/**
 * Enforce tab order: [Pinned] → [Grouped tabs] → [Ungrouped tabs]
 * After moving, re-groups tabs to restore group membership (chrome.tabs.move ungroups tabs).
 */
async function enforceTabOrder(windowId: number): Promise<void> {
  const allTabs = await chrome.tabs.query({ windowId });
  const pinned = allTabs.filter(t => t.pinned);
  const groups = await chrome.tabGroups.query({ windowId });

  let targetIndex = pinned.length;

  // Move grouped tabs first (in current group order)
  for (const group of groups) {
    const groupTabs = allTabs.filter(t => !t.pinned && t.groupId === group.id);
    const tabIds: number[] = [];
    for (const tab of groupTabs) {
      if (tab.id != null) {
        await chrome.tabs.move(tab.id, { index: targetIndex });
        tabIds.push(tab.id);
        targetIndex++;
      }
    }
    // Re-group after moving
    if (tabIds.length > 0) {
      await chrome.tabs.group({ tabIds, groupId: group.id });
    }
  }

  // Move ungrouped tabs after all groups
  const ungrouped = allTabs.filter(t => !t.pinned && (t.groupId === undefined || t.groupId === -1 || t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE));
  for (const tab of ungrouped) {
    if (tab.id != null) {
      await chrome.tabs.move(tab.id, { index: targetIndex });
      targetIndex++;
    }
  }
}

async function sortTabs(
  windowId: number,
  sortBy: SortBy,
  sortOrder: SortOrder,
  groupId?: number,
): Promise<void> {
  const workspace = await getActiveWorkspace();
  const priorityRules = workspace?.priorityRules ?? [];
  const allGroups = await chrome.tabGroups.query({ windowId });
  const pinnedTabs = await chrome.tabs.query({ windowId, pinned: true });
  let targetIndex = pinnedTabs.length;

  // Helper to sort a set of tabs with priority support
  const sortWithPriority = (tabs: chrome.tabs.Tab[], groupColor?: string) => {
    const priority: chrome.tabs.Tab[] = [];
    const normal: chrome.tabs.Tab[] = [];
    for (const tab of tabs) {
      if (priorityRules.length > 0 && isPriorityTab(tab, groupColor, priorityRules)) {
        priority.push(tab);
      } else {
        normal.push(tab);
      }
    }
    priority.sort((a, b) => compareTabs(a, b, sortBy, sortOrder));
    normal.sort((a, b) => compareTabs(a, b, sortBy, sortOrder));
    return [...priority, ...normal];
  };

  if (groupId !== undefined) {
    // Sort only within a specific group
    const tabs = await chrome.tabs.query({ windowId, groupId });
    const unpinned = tabs.filter(t => !t.pinned);
    const group = allGroups.find(g => g.id === groupId);
    const sorted = sortWithPriority(unpinned, group?.color);
    const startIdx = unpinned.length > 0 ? Math.min(...unpinned.map(t => t.index)) : 0;
    const tabIds: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].id != null) {
        await chrome.tabs.move(sorted[i].id!, { index: startIdx + i });
        tabIds.push(sorted[i].id!);
      }
    }
    if (tabIds.length > 0 && groupId !== -1) {
      await chrome.tabs.group({ tabIds, groupId });
    }
    return;
  }

  // Sort all tabs: each group independently, then ungrouped
  for (const group of allGroups) {
    const groupTabs = (await chrome.tabs.query({ windowId, groupId: group.id })).filter(t => !t.pinned);
    const sorted = sortWithPriority(groupTabs, group.color);
    const tabIds: number[] = [];
    for (const tab of sorted) {
      if (tab.id != null) {
        await chrome.tabs.move(tab.id, { index: targetIndex });
        tabIds.push(tab.id);
        targetIndex++;
      }
    }
    if (tabIds.length > 0) {
      await chrome.tabs.group({ tabIds, groupId: group.id });
    }
  }

  // Sort ungrouped tabs and place them after all groups
  const allTabs = await chrome.tabs.query({ windowId });
  const ungrouped = allTabs.filter(t => !t.pinned && (t.groupId === undefined || t.groupId === -1 || t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE));
  const sortedUngrouped = sortWithPriority(ungrouped);
  for (const tab of sortedUngrouped) {
    if (tab.id != null) {
      await chrome.tabs.move(tab.id, { index: targetIndex });
      targetIndex++;
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
    const settings = await getSettings();
    const colorOrder = settings.colorOrder ?? TAB_GROUP_COLORS;
    sorted = [...groups].sort((a, b) => {
      const aIdx = colorOrder.indexOf(a.color as any);
      const bIdx = colorOrder.indexOf(b.color as any);
      return aIdx - bIdx;
    });
  }

  // Layout: [Pinned] → [Groups in sorted order] → [Ungrouped]
  const pinnedTabs = await chrome.tabs.query({ windowId, pinned: true });
  let targetIndex = pinnedTabs.length;

  // Move each group's tabs in sorted order, re-group after moving
  for (const group of sorted) {
    const groupTabs = await chrome.tabs.query({ windowId, groupId: group.id });
    const tabIds: number[] = [];
    for (const tab of groupTabs) {
      if (tab.id != null) {
        await chrome.tabs.move(tab.id, { index: targetIndex });
        tabIds.push(tab.id);
        targetIndex++;
      }
    }
    if (tabIds.length > 0) {
      await chrome.tabs.group({ tabIds, groupId: group.id });
    }
  }

  // Move ungrouped tabs after all groups
  const allTabs = await chrome.tabs.query({ windowId });
  const ungrouped = allTabs.filter(t => !t.pinned && (t.groupId === undefined || t.groupId === -1 || t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE));
  for (const tab of ungrouped) {
    if (tab.id != null) {
      await chrome.tabs.move(tab.id, { index: targetIndex });
      targetIndex++;
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

  // Step 5: Enforce order: [Pinned] → [Groups] → [Ungrouped]
  await enforceTabOrder(windowId);

  // Step 6: Collapse all groups
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
