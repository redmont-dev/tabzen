import type { MessageBus } from '../message-bus';
import type { Settings, Workspace, GroupingRule, TabGroupColor } from '@/data/types';
import { SyncStorage } from '@/data/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants';
import { matchRules, extractDomain } from '../utils/rule-matcher';

async function getSettings(): Promise<Settings> {
  return SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

async function getActiveWorkspace(): Promise<Workspace | null> {
  const settings = await getSettings();
  const workspaces = await SyncStorage.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
  return workspaces.find(w => w.id === settings.activeWorkspaceId) ?? null;
}

interface GroupTarget {
  groupName: string;
  color: string;
  tabIds: number[];
}

async function applyRules(windowId: number): Promise<void> {
  const workspace = await getActiveWorkspace();
  if (!workspace) return;

  const rules = workspace.rules.filter(r => r.enabled);
  if (rules.length === 0) return;

  const tabs = await chrome.tabs.query({ windowId });
  const existingGroups = await chrome.tabGroups.query({ windowId });

  // Build a map of groupId -> group info for quick lookup
  const groupMap = new Map<number, chrome.tabGroups.TabGroup>();
  for (const g of existingGroups) {
    groupMap.set(g.id, g);
  }

  // Collect tabs that need grouping, bucketed by target group name+color
  const targets = new Map<string, GroupTarget>();

  for (const tab of tabs) {
    if (!tab.url || !tab.id || tab.pinned) continue;

    const matchedRule = matchRules(tab.url, rules);
    if (!matchedRule) continue;

    const key = `${matchedRule.groupName}::${matchedRule.color}`;

    // Check if tab is already in the correct group
    if (tab.groupId !== undefined && tab.groupId !== -1) {
      const currentGroup = groupMap.get(tab.groupId);
      if (
        currentGroup &&
        currentGroup.title === matchedRule.groupName &&
        currentGroup.color === matchedRule.color
      ) {
        continue; // Already correctly grouped
      }
    }

    if (!targets.has(key)) {
      targets.set(key, {
        groupName: matchedRule.groupName,
        color: matchedRule.color,
        tabIds: [],
      });
    }
    targets.get(key)!.tabIds.push(tab.id);
  }

  // Execute grouping
  for (const target of targets.values()) {
    if (target.tabIds.length === 0) continue;

    // Find existing group with matching name and color
    const existingGroup = existingGroups.find(
      g => g.title === target.groupName && g.color === target.color
    );

    if (existingGroup) {
      await chrome.tabs.group({
        tabIds: target.tabIds,
        groupId: existingGroup.id,
      });
    } else {
      const groupId = await chrome.tabs.group({
        tabIds: target.tabIds,
        createProperties: { windowId },
      });
      await chrome.tabGroups.update(groupId, {
        title: target.groupName,
        color: target.color as chrome.tabGroups.ColorEnum,
      });
    }
  }
}

async function autoGroupTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.url || !tab.id || tab.pinned) return;

  const workspace = await getActiveWorkspace();
  if (!workspace) return;

  const rules = workspace.rules.filter(r => r.enabled);
  if (rules.length === 0) return;

  const matchedRule = matchRules(tab.url, rules);
  if (!matchedRule) return;

  // Check if already in correct group
  if (tab.groupId !== undefined && tab.groupId !== -1) {
    const existingGroups = await chrome.tabGroups.query({ windowId: tab.windowId });
    const currentGroup = existingGroups.find(g => g.id === tab.groupId);
    if (
      currentGroup &&
      currentGroup.title === matchedRule.groupName &&
      currentGroup.color === matchedRule.color
    ) {
      return;
    }
  }

  // Find or create the target group
  const existingGroups = await chrome.tabGroups.query({ windowId: tab.windowId });
  const existingGroup = existingGroups.find(
    g => g.title === matchedRule.groupName && g.color === matchedRule.color
  );

  if (existingGroup) {
    await chrome.tabs.group({ tabIds: [tab.id], groupId: existingGroup.id });
  } else {
    const groupId = await chrome.tabs.group({
      tabIds: [tab.id],
      createProperties: { windowId: tab.windowId },
    });
    await chrome.tabGroups.update(groupId, {
      title: matchedRule.groupName,
      color: matchedRule.color as chrome.tabGroups.ColorEnum,
    });
  }
}

const SUGGESTION_THRESHOLD = 3;
const SUGGESTED_COLORS: TabGroupColor[] = [
  'blue', 'red', 'green', 'yellow', 'purple', 'cyan', 'orange', 'pink', 'grey',
];

async function getSuggestedRules(windowId: number): Promise<GroupingRule[]> {
  const workspace = await getActiveWorkspace();
  if (!workspace) return [];

  const rules = workspace.rules;
  const tabs = await chrome.tabs.query({ windowId });

  // Count ungrouped tabs per domain, excluding tabs that already match a rule
  const domainCounts = new Map<string, number>();

  for (const tab of tabs) {
    if (!tab.url || tab.pinned) continue;
    // Only consider ungrouped tabs
    if (tab.groupId !== undefined && tab.groupId !== -1) continue;

    // Skip if already covered by an existing rule
    if (rules.length > 0 && matchRules(tab.url, rules)) continue;

    const domain = extractDomain(tab.url);
    if (!domain) continue;

    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }

  // Filter to domains with 3+ ungrouped tabs
  const suggestions: { domain: string; count: number }[] = [];
  for (const [domain, count] of domainCounts) {
    if (count >= SUGGESTION_THRESHOLD) {
      suggestions.push({ domain, count });
    }
  }

  // Sort by count descending
  suggestions.sort((a, b) => b.count - a.count);

  // Convert to GroupingRule suggestions
  return suggestions.map((s, i) => ({
    id: `suggested-${s.domain}`,
    type: 'domain' as const,
    pattern: s.domain,
    groupName: s.domain,
    color: SUGGESTED_COLORS[i % SUGGESTED_COLORS.length],
    enabled: true,
    source: 'suggested' as const,
  }));
}

export { applyRules };

export function registerRuleEngine(bus: MessageBus): void {
  bus.register('applyRules', async (req) => {
    await applyRules(req.windowId);
    return { ok: true };
  });

  bus.register('getSuggestedRules', async (req) => {
    const suggestions = await getSuggestedRules(req.windowId);
    return { ok: true, data: suggestions };
  });

  // Auto-group tabs when their URL changes
  chrome.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.url) {
        autoGroupTab(tab);
      }
    },
  );
}
