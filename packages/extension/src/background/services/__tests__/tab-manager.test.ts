import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../message-bus';
import { registerTabManager } from '../tab-manager';
import { DEFAULT_SETTINGS } from '@/shared/constants';

describe('TabManager', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    registerTabManager(bus);
    vi.clearAllMocks();
  });

  describe('sortTabs', () => {
    it('sorts tabs by title A-Z within a window', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Banana', url: 'https://b.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Apple', url: 'https://a.com', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Cherry', url: 'https://c.com', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({
        action: 'sortTabs',
        windowId: 1,
        sortBy: 'title',
        sortOrder: 'asc',
      });

      expect(result.ok).toBe(true);
      // Apple, Banana, Cherry — moved as one block so no index goes stale
      expect(chrome.tabs.move).toHaveBeenCalledWith([2, 1, 3], { index: 0 });
    });

    it('sorts tabs by URL Z-A', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'A', url: 'https://a.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'C', url: 'https://c.com', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'B', url: 'https://b.com', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({
        action: 'sortTabs',
        windowId: 1,
        sortBy: 'url',
        sortOrder: 'desc',
      });

      expect(result.ok).toBe(true);
      // c.com, b.com, a.com descending — one move for the whole run
      expect(chrome.tabs.move).toHaveBeenCalledWith([2, 3, 1], { index: 0 });
    });

    it('sorts tabs within a specific group only', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Banana', url: 'https://b.com', index: 0, windowId: 1, groupId: 5, pinned: false },
        { id: 2, title: 'Apple', url: 'https://a.com', index: 1, windowId: 1, groupId: 5, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({
        action: 'sortTabs',
        windowId: 1,
        sortBy: 'title',
        sortOrder: 'asc',
        groupId: 5,
      });

      expect(result.ok).toBe(true);
      expect(chrome.tabs.query).toHaveBeenCalledWith({ windowId: 1, groupId: 5 });
    });

    it('skips pinned tabs during sort', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Pinned', url: 'https://p.com', index: 0, windowId: 1, groupId: -1, pinned: true },
        { id: 2, title: 'Banana', url: 'https://b.com', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Apple', url: 'https://a.com', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));

      await bus.dispatch({
        action: 'sortTabs',
        windowId: 1,
        sortBy: 'title',
        sortOrder: 'asc',
      });

      // Pinned tab should not be moved. Apple should move to index 1 (after pinned).
      const moveCalls = vi.mocked(chrome.tabs.move).mock.calls;
      const movedIds = moveCalls.map(c => c[0]);
      expect(movedIds).not.toContain(1);
    });
  });

  describe('sortTabs with priority rules', () => {
    it('sorts priority-matching tabs to the top of their group', async () => {
      // Set up settings with priority rules stored in workspace
      const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
      storageLocalData['workspaces'] = [{
        id: 'default',
        name: 'Default',
        icon: '',
        rules: [],
        priorityRules: [
          { id: 'p1', urlPrefix: 'https://important.com', colors: ['blue'] },
        ],
        settings: {
          defaultSortBy: 'title',
          defaultSortOrder: 'asc',
          groupSortMode: 'name',
          collapseAfterSort: false,
          removeDupsOnSort: false,
        },
        windowIds: [1],
        createdAt: 0,
      }];
      storageSyncData['settings'] = {
        ...(storageSyncData['settings'] as object),
        activeWorkspaceId: 'default',
      };

      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Banana', url: 'https://banana.com', index: 0, windowId: 1, groupId: 10, pinned: false },
        { id: 2, title: 'Important', url: 'https://important.com/doc', index: 1, windowId: 1, groupId: 10, pinned: false },
        { id: 3, title: 'Apple', url: 'https://apple.com', index: 2, windowId: 1, groupId: 10, pinned: false },
      ] as chrome.tabs.Tab[]));

      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      await bus.dispatch({
        action: 'sortTabs',
        windowId: 1,
        sortBy: 'title',
        sortOrder: 'asc',
        groupId: 10,
      });

      // Important (id:2) leads on priority, then Apple (3), then Banana (1)
      expect(chrome.tabs.move).toHaveBeenCalledWith([2, 3, 1], { index: 0 });
    });
  });

  describe('sortGroups', () => {
    it('moves each group as one block, in sorted order', async () => {
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 20, title: 'Zebra', color: 'red', collapsed: false, windowId: 1 },
        { id: 10, title: 'Alpha', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));
      vi.mocked(chrome.tabs.query).mockImplementation(async (info: chrome.tabs.QueryInfo) => {
        if (info.pinned) return [];
        if (info.groupId === 10) {
          return [{ id: 1, groupId: 10 }, { id: 2, groupId: 10 }] as chrome.tabs.Tab[];
        }
        if (info.groupId === 20) return [{ id: 3, groupId: 20 }] as chrome.tabs.Tab[];
        return [];
      });

      const result = await bus.dispatch({ action: 'sortGroups', windowId: 1, mode: 'name' });

      expect(result.ok).toBe(true);
      // Alpha first at index 0, Zebra after it at index 2
      expect(chrome.tabs.move).toHaveBeenNthCalledWith(1, [1, 2], { index: 0 });
      expect(chrome.tabs.move).toHaveBeenNthCalledWith(2, [3], { index: 2 });
    });

    it('recreates a group Chrome destroyed mid-move, keeping its title and color', async () => {
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: true, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));
      vi.mocked(chrome.tabs.query).mockImplementation(async (info: chrome.tabs.QueryInfo) => {
        if (info.pinned) return [];
        if (info.groupId === 10) return [{ id: 1, groupId: 10 }] as chrome.tabs.Tab[];
        return [];
      });
      // Emptying the group deletes it, so re-grouping by the old id fails
      vi.mocked(chrome.tabs.group)
        .mockImplementationOnce(async () => { throw new Error('No group with id: 10'); })
        .mockImplementationOnce(async () => 99);

      const result = await bus.dispatch({ action: 'sortGroups', windowId: 1, mode: 'name' });

      expect(result.ok).toBe(true);
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(99, {
        title: 'Work',
        color: 'blue',
        collapsed: true,
      });
    });
  });

  describe('duplicate scope', () => {
    async function setScope(dedupScope: 'window' | 'all-windows') {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = { ...DEFAULT_SETTINGS, dedupScope };
    }

    /** Two windows, each holding the same URL. */
    function twoWindowsSharingAUrl() {
      const tabs = [
        { id: 1, url: 'https://a.com', windowId: 1, pinned: false },
        { id: 2, url: 'https://a.com', windowId: 2, pinned: false },
      ] as chrome.tabs.Tab[];
      vi.mocked(chrome.tabs.query).mockImplementation(async (info: chrome.tabs.QueryInfo) =>
        info.windowId === undefined ? tabs : tabs.filter(t => t.windowId === info.windowId),
      );
    }

    it('leaves another window alone by default', async () => {
      await setScope('window');
      twoWindowsSharingAUrl();

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      expect(result.data).toEqual({ removed: 0 });
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    it('closes the newer copy in another window when scope is all-windows', async () => {
      await setScope('all-windows');
      twoWindowsSharingAUrl();

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      expect(result.data).toEqual({ removed: 1 });
      // First encountered wins, so the window-1 copy survives
      expect(chrome.tabs.remove).toHaveBeenCalledWith(2);
      expect(chrome.tabs.remove).not.toHaveBeenCalledWith(1);
    });

    it('still refuses to close a pinned duplicate across windows', async () => {
      await setScope('all-windows');
      const tabs = [
        { id: 1, url: 'https://a.com', windowId: 1, pinned: false },
        { id: 2, url: 'https://a.com', windowId: 2, pinned: true },
      ] as chrome.tabs.Tab[];
      vi.mocked(chrome.tabs.query).mockImplementation(async (info: chrome.tabs.QueryInfo) =>
        info.windowId === undefined ? tabs : tabs.filter(t => t.windowId === info.windowId),
      );

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      expect(result.data).toEqual({ removed: 0 });
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });

  describe('cleanUp', () => {
    it('moves ungrouped tabs to the end in one call', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = {
        ...DEFAULT_SETTINGS,
        cleanupSort: false,
        cleanupGroup: false,
        cleanupDedup: false,
        cleanupSortGroups: false,
        cleanupCollapse: false,
      };
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, groupId: -1, pinned: true, index: 0 },
        { id: 2, groupId: 5, pinned: false, index: 1 },
        { id: 3, groupId: -1, pinned: false, index: 2 },
        { id: 4, groupId: -1, pinned: false, index: 3 },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'cleanUp', windowId: 1 });

      expect(result.ok).toBe(true);
      // Unpinned + ungrouped only, sent to the end together
      expect(chrome.tabs.move).toHaveBeenCalledWith([3, 4], { index: -1 });
    });
  });

  describe('removeDuplicates', () => {
    beforeEach(async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = {
        dedupEnabled: true,
        stripFragments: true,
        stripTrailingSlash: true,
        protocolAgnostic: true,
      };
    });

    it('closes duplicate tabs keeping the first occurrence', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://example.com/page', index: 0, windowId: 1, pinned: false },
        { id: 2, url: 'https://example.com/other', index: 1, windowId: 1, pinned: false },
        { id: 3, url: 'https://example.com/page', index: 2, windowId: 1, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ removed: 1 });
      expect(chrome.tabs.remove).toHaveBeenCalledWith(3);
    });

    it('treats http and https as same URL when protocolAgnostic is true', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://example.com/page', index: 0, windowId: 1, pinned: false },
        { id: 2, url: 'http://example.com/page', index: 1, windowId: 1, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      expect(result.data).toEqual({ removed: 1 });
      expect(chrome.tabs.remove).toHaveBeenCalledWith(2);
    });

    it('strips fragments before comparing', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://example.com/page', index: 0, windowId: 1, pinned: false },
        { id: 2, url: 'https://example.com/page#section', index: 1, windowId: 1, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      expect(result.data).toEqual({ removed: 1 });
    });

    it('does not close pinned tabs', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://example.com/page', index: 0, windowId: 1, pinned: true },
        { id: 2, url: 'https://example.com/page', index: 1, windowId: 1, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      // Both kept — pinned tab is first, unpinned is second, they're "different" in that the pinned one should stay
      // Actually, the pinned one is seen first, and the unpinned duplicate is removed
      expect(result.data).toEqual({ removed: 1 });
      expect(chrome.tabs.remove).toHaveBeenCalledWith(2);
    });

    it('returns removed count of 0 when no duplicates', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://a.com', index: 0, windowId: 1, pinned: false },
        { id: 2, url: 'https://b.com', index: 1, windowId: 1, pinned: false },
      ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'removeDuplicates', windowId: 1 });

      expect(result.data).toEqual({ removed: 0 });
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });

  describe('sortGroups', () => {
    it('sorts groups by name alphabetically', async () => {
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
        { id: 11, title: 'Fun', color: 'green', collapsed: false, windowId: 1 },
        { id: 12, title: 'Dev', color: 'red', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      // Each group has one tab
      vi.mocked(chrome.tabs.query)
        .mockImplementationOnce(async () => ([ // Dev group tabs
          { id: 30, groupId: 12, index: 4, windowId: 1, pinned: false },
        ] as chrome.tabs.Tab[]))
        .mockImplementationOnce(async () => ([ // Fun group tabs
          { id: 20, groupId: 11, index: 2, windowId: 1, pinned: false },
        ] as chrome.tabs.Tab[]))
        .mockImplementationOnce(async () => ([ // Work group tabs
          { id: 10, groupId: 10, index: 0, windowId: 1, pinned: false },
        ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'sortGroups', windowId: 1, mode: 'name' });

      expect(result.ok).toBe(true);
      // Groups should be moved in alphabetical order: Dev, Fun, Work
      expect(chrome.tabs.move).toHaveBeenCalled();
    });

    it('sorts groups by color using color order from settings', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = {
        ...(storageSyncData['settings'] as object),
        colorOrder: ['red', 'blue', 'green', 'grey', 'yellow', 'pink', 'purple', 'cyan', 'orange'],
      };

      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'A', color: 'blue', collapsed: false, windowId: 1 },
        { id: 11, title: 'B', color: 'red', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      vi.mocked(chrome.tabs.query)
        .mockImplementationOnce(async () => ([ // red (B) group first in color order
          { id: 20, groupId: 11, index: 2, windowId: 1, pinned: false },
        ] as chrome.tabs.Tab[]))
        .mockImplementationOnce(async () => ([ // blue (A) group second
          { id: 10, groupId: 10, index: 0, windowId: 1, pinned: false },
        ] as chrome.tabs.Tab[]));

      const result = await bus.dispatch({ action: 'sortGroups', windowId: 1, mode: 'color' });

      expect(result.ok).toBe(true);
      expect(chrome.tabs.move).toHaveBeenCalled();
    });
  });

  describe('collapseAll', () => {
    it('collapses all groups in a window', async () => {
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
        { id: 11, title: 'Fun', color: 'green', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      const result = await bus.dispatch({ action: 'collapseAll', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(10, { collapsed: true });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(11, { collapsed: true });
    });

    it('handles window with no groups', async () => {
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const result = await bus.dispatch({ action: 'collapseAll', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(chrome.tabGroups.update).not.toHaveBeenCalled();
    });
  });

  describe('cleanUp', () => {
    beforeEach(async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = {
        ...DEFAULT_SETTINGS,
        cleanupDedup: true,
        cleanupGroup: true,
        cleanupSort: true,
        cleanupSortGroups: true,
        cleanupCollapse: true,
      };
    });

    it('runs all enabled cleanup steps', async () => {
      // Minimal mocks so each step doesn't fail
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://a.com', title: 'A', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const result = await bus.dispatch({ action: 'cleanUp', windowId: 1 });

      expect(result.ok).toBe(true);
    });

    it('skips disabled cleanup steps', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData['settings'] = {
        ...DEFAULT_SETTINGS,
        cleanupDedup: false,
        cleanupGroup: false,
        cleanupSort: false,
        cleanupSortGroups: false,
        cleanupCollapse: false,
      };

      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const result = await bus.dispatch({ action: 'cleanUp', windowId: 1 });

      expect(result.ok).toBe(true);
      // With everything disabled, no tab mutations should happen
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
      expect(chrome.tabs.move).not.toHaveBeenCalled();
    });
  });

  describe('getWindowInfo', () => {
    it('returns tabs and groups for a window', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab 1', url: 'https://a.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Tab 2', url: 'https://b.com', index: 1, windowId: 1, groupId: 10, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      const result = await bus.dispatch({ action: 'getWindowInfo', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({
        tabs: expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 }),
        ]),
        groups: expect.arrayContaining([
          expect.objectContaining({ id: 10, title: 'Work' }),
        ]),
      });
    });
  });
});
