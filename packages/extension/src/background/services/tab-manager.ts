import type { MessageBus } from '../message-bus';
import type { SortBy, SortOrder, Workspace, PriorityRule, GroupSortMode, TabGroupColor } from '@/data/types';
import { LocalStorage } from '@/data/storage';
import { getSettings } from '@/data/settings';
import { STORAGE_KEYS, TAB_GROUP_COLORS } from '@/shared/constants';
import { normalizeUrl } from '../utils/url-normalize';

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
      if (rule.colors.length === 0 || (groupColor && rule.colors.includes(groupColor as TabGroupColor))) {
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
 * Put `tabIds` back into `group` after a move.
 *
 * chrome.tabs.move pulls tabs out of their group, and Chrome deletes a group
 * the moment its last tab leaves. Re-grouping by the old id then fails, which
 * would abort the whole sort and lose the group's title and color. When that
 * happens, recreate the group and restore its appearance instead.
 */
async function regroupTabs(
  tabIds: number[],
  group: Pick<chrome.tabGroups.TabGroup, 'id' | 'title' | 'color' | 'collapsed'>,
): Promise<void> {
  if (tabIds.length === 0) return;
  const ids = tabIds as [number, ...number[]];

  try {
    await chrome.tabs.group({ tabIds: ids, groupId: group.id });
    return;
  } catch {
    // Group was destroyed when its last tab moved out — recreate it below.
  }

  const newGroupId = await chrome.tabs.group({ tabIds: ids });
  await chrome.tabGroups.update(newGroupId, {
    title: group.title ?? '',
    color: group.color,
    collapsed: group.collapsed,
  });
}

async function sortTabsInGroup(
  tabs: chrome.tabs.Tab[],
  sortBy: SortBy,
  sortOrder: SortOrder,
  groupColor: string | undefined,
  priorityRules: PriorityRule[],
  gId: number | undefined,
  group?: chrome.tabGroups.TabGroup,
): Promise<void> {
  const unpinned = tabs.filter(t => !t.pinned);
  if (unpinned.length === 0) return;

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

  priority.sort((a, b) => compareTabs(a, b, sortBy, sortOrder));
  normal.sort((a, b) => compareTabs(a, b, sortBy, sortOrder));

  const sorted = [...priority, ...normal];

  const startIndex = Math.min(...unpinned.map(t => t.index));
  const tabIds = sorted.map(t => t.id).filter((id): id is number => id != null);

  // One move for the whole run: moving tabs one at a time invalidates every
  // index behind the one just moved, and briefly empties the group.
  if (tabIds.length > 0) {
    await chrome.tabs.move(tabIds, { index: startIndex });
  }

  // Re-group tabs after move (chrome.tabs.move removes tabs from groups)
  if (gId !== undefined && gId !== -1) {
    await regroupTabs(tabIds, group ?? { id: gId, title: '', color: 'grey', collapsed: false });
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

  if (groupId !== undefined) {
    // Sort within a specific group
    const tabs = await chrome.tabs.query({ windowId, groupId });
    let group: chrome.tabGroups.TabGroup | undefined;

    if (groupId !== -1) {
      const groups = await chrome.tabGroups.query({ windowId });
      group = groups.find(g => g.id === groupId);
    }

    const groupColor = priorityRules.length > 0 ? group?.color : undefined;
    await sortTabsInGroup(tabs, sortBy, sortOrder, groupColor, priorityRules, groupId, group);
  } else {
    // Sort all tabs in window, group by group
    const groups = await chrome.tabGroups.query({ windowId });

    // Sort each group's tabs independently
    for (const group of groups) {
      const groupTabs = await chrome.tabs.query({ windowId, groupId: group.id });
      const groupColor = priorityRules.length > 0 ? group.color : undefined;
      await sortTabsInGroup(groupTabs, sortBy, sortOrder, groupColor, priorityRules, group.id, group);
    }

    // Sort ungrouped tabs
    const allTabs = await chrome.tabs.query({ windowId });
    const ungrouped = allTabs.filter(t => t.groupId === -1);
    await sortTabsInGroup(ungrouped, sortBy, sortOrder, undefined, priorityRules, undefined);
  }
}

async function removeDuplicates(windowId: number): Promise<number> {
  const settings = await getSettings();
  // 'all-windows' compares against every open tab; the tab kept for each URL is
  // still the first one encountered, so the user's oldest copy survives.
  const tabs = settings.dedupScope === 'all-windows'
    ? await chrome.tabs.query({})
    : await chrome.tabs.query({ windowId });
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
      const aIdx = colorOrder.indexOf(a.color as TabGroupColor);
      const bIdx = colorOrder.indexOf(b.color as TabGroupColor);
      return aIdx - bIdx;
    });
  }

  // Move each group's tabs in the sorted order, starting after the pinned tabs.
  const pinnedTabs = await chrome.tabs.query({ windowId, pinned: true });
  let targetIndex = pinnedTabs.length;

  for (const group of sorted) {
    const groupTabs = await chrome.tabs.query({ windowId, groupId: group.id });
    const tabIds = groupTabs.map(t => t.id).filter((id): id is number => id != null);
    if (tabIds.length === 0) continue;

    // Move the group's tabs as one block — moving them individually leaves the
    // group empty partway through, at which point Chrome deletes it.
    await chrome.tabs.move(tabIds, { index: targetIndex });
    targetIndex += tabIds.length;

    // Re-group tabs after move (chrome.tabs.move removes tabs from groups)
    await regroupTabs(tabIds, group);
  }
}

async function collapseAllGroups(windowId: number): Promise<void> {
  const groups = await chrome.tabGroups.query({ windowId });
  for (const group of groups) {
    await chrome.tabGroups.update(group.id, { collapsed: true });
  }
}

/**
 * Enforce tab order: [Pinned] -> [Groups] -> [Ungrouped]
 */
async function enforceTabOrder(windowId: number): Promise<void> {
  const allTabs = await chrome.tabs.query({ windowId });

  // Move ungrouped unpinned tabs to the end, preserving their relative order.
  // index -1 means "the end", which stays correct as the move happens; the
  // per-tab indexes captured above go stale after the first move.
  const ungroupedIds = allTabs
    .filter(t => !t.pinned && t.groupId === -1)
    .map(t => t.id)
    .filter((id): id is number => id != null);

  if (ungroupedIds.length > 0) {
    await chrome.tabs.move(ungroupedIds, { index: -1 });
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

  // Step 6: Enforce tab order
  await enforceTabOrder(windowId);
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
