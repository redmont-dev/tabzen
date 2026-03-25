import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../message-bus';
import { registerRuleEngine } from '../rule-engine';

describe('RuleEngine', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    bus = new MessageBus();
    registerRuleEngine(bus);

    const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
    // Clear storage between tests
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];
  });

  describe('applyRules', () => {
    it('groups ungrouped tabs that match a prefix rule', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
      storageLocalData['workspaces'] = [{
        id: 'default',
        name: 'Default',
        icon: '',
        rules: [
          { id: 'r1', type: 'prefix', pattern: 'https://github.com', groupName: 'GitHub', color: 'blue', enabled: true, source: 'user' },
        ],
        priorityRules: [],
        settings: { defaultSortBy: 'title', defaultSortOrder: 'asc', groupSortMode: 'name', collapseAfterSort: false, removeDupsOnSort: false },
        windowIds: [1],
        createdAt: 0,
      }];

      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://github.com/repo', title: 'Repo', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, url: 'https://google.com', title: 'Google', index: 1, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);

      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
      vi.mocked(chrome.tabs.group).mockResolvedValue(10);

      const result = await bus.dispatch({ action: 'applyRules', windowId: 1 });

      expect(result.ok).toBe(true);
      // Tab 1 should be grouped
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [1],
        createProperties: { windowId: 1 },
      });
      // The new group should be titled and colored
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(10, {
        title: 'GitHub',
        color: 'blue',
      });
    });

    it('adds tab to existing group with same name and color', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
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

      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://github.com/repo', title: 'Repo', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);

      // There's already a "GitHub" blue group
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([
        { id: 10, title: 'GitHub', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]);

      const result = await bus.dispatch({ action: 'applyRules', windowId: 1 });

      expect(result.ok).toBe(true);
      // Should add to existing group instead of creating new
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [1],
        groupId: 10,
      });
    });

    it('does not regroup tabs already in the correct group', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
      storageLocalData['workspaces'] = [{
        id: 'default',
        name: 'Default',
        icon: '',
        rules: [
          { id: 'r1', type: 'prefix', pattern: 'https://github.com', groupName: 'GitHub', color: 'blue', enabled: true, source: 'user' },
        ],
        priorityRules: [],
        settings: { defaultSortBy: 'title', defaultSortOrder: 'asc', groupSortMode: 'name', collapseAfterSort: false, removeDupsOnSort: false },
        windowIds: [1],
        createdAt: 0,
      }];

      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://github.com/repo', title: 'Repo', index: 0, windowId: 1, groupId: 10, pinned: false },
      ] as chrome.tabs.Tab[]);

      vi.mocked(chrome.tabGroups.query).mockResolvedValue([
        { id: 10, title: 'GitHub', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]);

      await bus.dispatch({ action: 'applyRules', windowId: 1 });

      // Tab is already in the matching group — should not call tabs.group
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
  });

  describe('auto-group on tab update', () => {
    it('registers a listener on chrome.tabs.onUpdated', () => {
      // registerRuleEngine was called in beforeEach
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
    });

    it('auto-groups a tab when its URL changes to match a rule', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
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

      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
      vi.mocked(chrome.tabs.group).mockResolvedValue(10);

      // Simulate the onUpdated callback
      const onUpdatedCallback = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls[0][0] as (
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
        tab: chrome.tabs.Tab,
      ) => void;

      onUpdatedCallback(1, { url: 'https://github.com/anthropics' }, {
        id: 1,
        url: 'https://github.com/anthropics',
        title: 'Anthropic',
        index: 0,
        windowId: 1,
        groupId: -1,
        pinned: false,
      } as chrome.tabs.Tab);

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [1],
        createProperties: { windowId: 1 },
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(10, {
        title: 'GitHub',
        color: 'blue',
      });
    });

    it('does not auto-group when URL change does not match any rule', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
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

      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const onUpdatedCallback = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls[0][0] as (
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
        tab: chrome.tabs.Tab,
      ) => void;

      onUpdatedCallback(1, { url: 'https://gitlab.com/repo' }, {
        id: 1,
        url: 'https://gitlab.com/repo',
        title: 'GitLab',
        index: 0,
        windowId: 1,
        groupId: -1,
        pinned: false,
      } as chrome.tabs.Tab);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    it('does not auto-group pinned tabs', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
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

      const onUpdatedCallback = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls[0][0] as (
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
        tab: chrome.tabs.Tab,
      ) => void;

      onUpdatedCallback(1, { url: 'https://github.com/repo' }, {
        id: 1,
        url: 'https://github.com/repo',
        title: 'Repo',
        index: 0,
        windowId: 1,
        groupId: -1,
        pinned: true,
      } as chrome.tabs.Tab);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
  });

  describe('getSuggestedRules', () => {
    it('suggests a domain rule when 3+ ungrouped tabs share a domain', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
      storageLocalData['workspaces'] = [{
        id: 'default',
        name: 'Default',
        icon: '',
        rules: [],
        priorityRules: [],
        settings: { defaultSortBy: 'title', defaultSortOrder: 'asc', groupSortMode: 'name', collapseAfterSort: false, removeDupsOnSort: false },
        windowIds: [1],
        createdAt: 0,
      }];

      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, url: 'https://github.com/repo3', title: 'Repo 3', index: 2, windowId: 1, groupId: -1, pinned: false },
        { id: 4, url: 'https://google.com/search', title: 'Search', index: 3, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);

      const result = await bus.dispatch({ action: 'getSuggestedRules', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(expect.objectContaining({
        type: 'domain',
        pattern: 'github.com',
        groupName: 'github.com',
        source: 'suggested',
      }));
    });

    it('does not suggest rules for domains already covered by a rule', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
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

      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, url: 'https://github.com/repo3', title: 'Repo 3', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);

      const result = await bus.dispatch({ action: 'getSuggestedRules', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('does not suggest for grouped tabs', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
      storageLocalData['workspaces'] = [{
        id: 'default',
        name: 'Default',
        icon: '',
        rules: [],
        priorityRules: [],
        settings: { defaultSortBy: 'title', defaultSortOrder: 'asc', groupSortMode: 'name', collapseAfterSort: false, removeDupsOnSort: false },
        windowIds: [1],
        createdAt: 0,
      }];

      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', index: 0, windowId: 1, groupId: 10, pinned: false },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', index: 1, windowId: 1, groupId: 10, pinned: false },
        { id: 3, url: 'https://github.com/repo3', title: 'Repo 3', index: 2, windowId: 1, groupId: 10, pinned: false },
      ] as chrome.tabs.Tab[]);

      const result = await bus.dispatch({ action: 'getSuggestedRules', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('returns suggestions sorted by tab count descending', async () => {
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { activeWorkspaceId: 'default' };
      storageLocalData['workspaces'] = [{
        id: 'default',
        name: 'Default',
        icon: '',
        rules: [],
        priorityRules: [],
        settings: { defaultSortBy: 'title', defaultSortOrder: 'asc', groupSortMode: 'name', collapseAfterSort: false, removeDupsOnSort: false },
        windowIds: [1],
        createdAt: 0,
      }];

      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://github.com/a', title: 'A', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, url: 'https://github.com/b', title: 'B', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, url: 'https://github.com/c', title: 'C', index: 2, windowId: 1, groupId: -1, pinned: false },
        { id: 4, url: 'https://docs.google.com/a', title: 'D1', index: 3, windowId: 1, groupId: -1, pinned: false },
        { id: 5, url: 'https://docs.google.com/b', title: 'D2', index: 4, windowId: 1, groupId: -1, pinned: false },
        { id: 6, url: 'https://docs.google.com/c', title: 'D3', index: 5, windowId: 1, groupId: -1, pinned: false },
        { id: 7, url: 'https://docs.google.com/d', title: 'D4', index: 6, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);

      const result = await bus.dispatch({ action: 'getSuggestedRules', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(2);
      // docs.google.com has 4 tabs, github.com has 3 — docs first
      expect(result.data[0].pattern).toBe('docs.google.com');
      expect(result.data[1].pattern).toBe('github.com');
    });
  });
});
