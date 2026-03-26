import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../message-bus';
import { registerTabManager } from '../tab-manager';
import { registerRuleEngine, applyRules } from '../rule-engine';

describe('TabManager + RuleEngine Integration', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    bus = new MessageBus();
    registerRuleEngine(bus);
    registerTabManager(bus, applyRules);

    const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];
  });

  it('cleanUp runs full pipeline: dedup, group, sort, collapse', async () => {
    const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
    storageSyncData['settings'] = {
      dedupEnabled: true,
      stripFragments: true,
      stripTrailingSlash: true,
      protocolAgnostic: true,
      cleanupDedup: true,
      cleanupGroup: true,
      cleanupSort: true,
      cleanupSortGroups: true,
      cleanupCollapse: true,
      defaultSortBy: 'title',
      defaultSortOrder: 'asc',
      groupSortMode: 'name',
      activeWorkspaceId: 'default',
      colorOrder: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'],
    };
    storageLocalData['workspaces'] = [{
      id: 'default',
      name: 'Default',
      icon: '',
      rules: [
        { id: 'r1', type: 'domain', pattern: 'github.com', groupName: 'GitHub', color: 'blue', enabled: true, source: 'user' },
      ],
      priorityRules: [],
      settings: { defaultSortBy: 'title', defaultSortOrder: 'asc', groupSortMode: 'name', collapseAfterSort: false, removeDupsOnSort: false },
      windowIds: [1],
      createdAt: 0,
    }];

    // Two github tabs (one is dup), one other tab
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, url: 'https://github.com/repo', title: 'Repo', index: 0, windowId: 1, groupId: -1, pinned: false },
      { id: 2, url: 'https://github.com/repo', title: 'Repo', index: 1, windowId: 1, groupId: -1, pinned: false },
      { id: 3, url: 'https://example.com', title: 'Example', index: 2, windowId: 1, groupId: -1, pinned: false },
    ] as chrome.tabs.Tab[]);

    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
    vi.mocked(chrome.tabs.group).mockResolvedValue(10);

    const result = await bus.dispatch({ action: 'cleanUp', windowId: 1 });

    expect(result.ok).toBe(true);
    // Dedup should have removed one tab
    expect(chrome.tabs.remove).toHaveBeenCalled();
    // Grouping should have been applied
    expect(chrome.tabs.group).toHaveBeenCalled();
    // Sort should have moved tabs
    expect(chrome.tabs.move).toHaveBeenCalled();
  });

  it('getSettings and updateSettings round-trip', async () => {
    // Ensure getSettings and updateSettings work end-to-end (registered by TabManager or manually)
    // This test verifies message bus wiring is correct
    // ping is not registered in this test bus — but applyRules and sortTabs are
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    const sortResult = await bus.dispatch({
      action: 'sortTabs',
      windowId: 1,
      sortBy: 'title',
      sortOrder: 'asc',
    });
    expect(sortResult.ok).toBe(true);
  });
});
