import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../message-bus';
import {
  MENU_IDS,
  createMenuItems,
  handleMenuClick,
  registerContextMenus,
  refreshGroupSubmenu,
  GROUP_MENU_PREFIX,
} from '../context-menus';
import { GROUP_MENU_IDS_KEY } from '@/shared/constants';
import { registerTabManager } from '../tab-manager';
import { registerSearchIndex } from '../search-index';

describe('ContextMenus', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    bus = new MessageBus();

    // Register dependent services for delegation
    registerTabManager(bus);
    registerSearchIndex(bus);

    // Register workspace-related handlers for context menu delegation
    bus.register('getActiveWorkspace', async () => ({
      ok: true,
      data: { id: 'default', name: 'Default', rules: [] },
    }));
    bus.register('saveSession', async () => ({ ok: true, data: { id: 'sess-1' } }));
  });

  describe('createMenuItems', () => {
    it('creates all expected menu items', () => {
      createMenuItems();

      expect(chrome.contextMenus.create).toHaveBeenCalledTimes(6);

      // Verify each menu item was created
      const calls = vi.mocked(chrome.contextMenus.create).mock.calls;
      const ids = calls.map(c => (c[0] as { id: string }).id);

      expect(ids).toContain(MENU_IDS.MOVE_TO_GROUP);
      expect(ids).toContain(MENU_IDS.MOVE_TO_NEW_GROUP);
      expect(ids).toContain(MENU_IDS.CREATE_RULE);
      expect(ids).toContain(MENU_IDS.FIND_DUPLICATES);
      expect(ids).toContain(MENU_IDS.SAVE_TO_SESSION);
      expect(ids).toContain(MENU_IDS.CLOSE_DUPLICATES);
    });

    it('creates "New group" as child of "Move to group"', () => {
      createMenuItems();

      const newGroupCall = vi.mocked(chrome.contextMenus.create).mock.calls.find(
        c => (c[0] as { id: string }).id === MENU_IDS.MOVE_TO_NEW_GROUP
      );
      expect(newGroupCall).toBeDefined();
      expect((newGroupCall![0] as { parentId: string }).parentId).toBe(MENU_IDS.MOVE_TO_GROUP);
    });
  });

  describe('registerContextMenus', () => {
    it('registers onInstalled and onStartup listeners', () => {
      registerContextMenus(bus);

      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled();
      expect(chrome.contextMenus.onClicked.addListener).toHaveBeenCalled();
    });
  });

  describe('handleMenuClick', () => {
    const mockTab: chrome.tabs.Tab = {
      id: 1,
      windowId: 1,
      url: 'https://github.com/user/repo',
      title: 'GitHub Repo',
      index: 0,
      pinned: false,
      highlighted: false,
      active: true,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      frozen: false,
    };

    it('moves tab to a new group when "New group" is clicked', async () => {
      vi.mocked(chrome.tabs.group).mockImplementation(async () => (42));

      await handleMenuClick(
        bus,
        { menuItemId: MENU_IDS.MOVE_TO_NEW_GROUP } as chrome.contextMenus.OnClickData,
        mockTab,
      );

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [1],
        createProperties: { windowId: 1 },
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(42, { title: 'github.com' });
    });

    it('moves tab to existing group when group submenu item is clicked', async () => {
      await handleMenuClick(
        bus,
        { menuItemId: 'tabzen-group-10' } as chrome.contextMenus.OnClickData,
        mockTab,
      );

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [1],
        groupId: 10,
      });
    });

    it('dispatches removeDuplicates when "Close duplicates" is clicked', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([]));

      await handleMenuClick(
        bus,
        { menuItemId: MENU_IDS.CLOSE_DUPLICATES } as chrome.contextMenus.OnClickData,
        mockTab,
      );

      // removeDuplicates handler runs via bus.dispatch
      expect(chrome.tabs.query).toHaveBeenCalledWith({ windowId: 1 });
    });

    it('hands the query to the side panel when "Find duplicates" is clicked', async () => {
      await handleMenuClick(
        bus,
        { menuItemId: MENU_IDS.FIND_DUPLICATES } as chrome.contextMenus.OnClickData,
        mockTab,
      );

      const { storageSessionData } = await import('../../../../tests/setup');
      const { PENDING_SEARCH_KEY } = await import('@/shared/constants');
      expect(storageSessionData[PENDING_SEARCH_KEY]).toBe(mockTab.url);
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 1 });
    });

    it('creates a domain rule in the active workspace when "Create rule" is clicked', async () => {
      const updateCalls: Array<{ workspaceId: string; updates: { rules?: unknown[] } }> = [];
      bus.register('updateWorkspace', async (req) => {
        updateCalls.push(req as never);
        return { ok: true, data: {} };
      });
      let rulesApplied = false;
      bus.register('applyRules', async () => {
        rulesApplied = true;
        return { ok: true };
      });

      await handleMenuClick(
        bus,
        { menuItemId: MENU_IDS.CREATE_RULE } as chrome.contextMenus.OnClickData,
        mockTab,
      );

      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].workspaceId).toBe('default');
      expect(updateCalls[0].updates.rules).toHaveLength(1);
      expect(updateCalls[0].updates.rules![0]).toMatchObject({
        type: 'domain',
        pattern: 'github.com',
        groupName: 'github.com',
        enabled: true,
        source: 'user',
      });
      expect(rulesApplied).toBe(true);
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Rule created' }),
      );
    });

    it('does not duplicate an existing rule for the same domain', async () => {
      const freshBus = new MessageBus();
      freshBus.register('getActiveWorkspace', async () => ({
        ok: true,
        data: {
          id: 'default',
          name: 'Default',
          rules: [{ id: 'r1', type: 'domain', pattern: 'github.com', groupName: 'GitHub', color: 'blue', enabled: true, source: 'user' }],
        },
      }));
      const updateWorkspace = vi.fn(async () => ({ ok: true }));
      freshBus.register('updateWorkspace', updateWorkspace);

      await handleMenuClick(
        freshBus,
        { menuItemId: MENU_IDS.CREATE_RULE } as chrome.contextMenus.OnClickData,
        mockTab,
      );

      expect(updateWorkspace).not.toHaveBeenCalled();
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Rule already exists' }),
      );
    });

    it('does nothing when tab has no id', async () => {
      const noIdTab = { ...mockTab, id: undefined };
      await handleMenuClick(
        bus,
        { menuItemId: MENU_IDS.SAVE_TO_SESSION } as chrome.contextMenus.OnClickData,
        noIdTab as chrome.tabs.Tab,
      );

      // Should not throw or call any chrome APIs
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
  });

  describe('move-to-group submenu', () => {
    beforeEach(async () => {
      const { storageSessionData } = await import('../../../../tests/setup');
      for (const k of Object.keys(storageSessionData)) delete storageSessionData[k];
      vi.mocked(chrome.windows.getLastFocused).mockImplementation(async () => ({ id: 1 } as chrome.windows.Window));
    });

    it('builds one item per group in the focused window', async () => {
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
        { id: 20, title: 'Reading', color: 'green', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      await refreshGroupSubmenu();

      expect(chrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `${GROUP_MENU_PREFIX}10`,
          title: 'Work',
          parentId: MENU_IDS.MOVE_TO_GROUP,
        }),
      );
      expect(chrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: `${GROUP_MENU_PREFIX}20`, title: 'Reading' }),
      );
    });

    it('labels an untitled group by its color instead of leaving it blank', async () => {
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: '', color: 'cyan', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      await refreshGroupSubmenu();

      expect(chrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Untitled (cyan)' }),
      );
    });

    it('removes the previous items so rebuilds do not stack duplicates', async () => {
      const { storageSessionData } = await import('../../../../tests/setup');
      storageSessionData[GROUP_MENU_IDS_KEY] = [`${GROUP_MENU_PREFIX}99`];
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => []);

      await refreshGroupSubmenu();

      expect(chrome.contextMenus.remove).toHaveBeenCalledWith(`${GROUP_MENU_PREFIX}99`);
      expect(storageSessionData[GROUP_MENU_IDS_KEY]).toEqual([]);
    });

    it('moves the tab into the group the clicked item names', async () => {
      await handleMenuClick(
        bus,
        { menuItemId: `${GROUP_MENU_PREFIX}42` } as chrome.contextMenus.OnClickData,
        { id: 7, windowId: 1 } as chrome.tabs.Tab,
      );

      expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [7], groupId: 42 });
    });
  });
});