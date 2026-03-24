import type { MessageBus } from '../message-bus';
import { extractDomain } from '../utils/rule-matcher';

const MENU_IDS = {
  ROOT: 'tabzen-root',
  MOVE_TO_GROUP: 'tabzen-move-to-group',
  MOVE_TO_NEW_GROUP: 'tabzen-move-new-group',
  CREATE_RULE: 'tabzen-create-rule',
  FIND_DUPLICATES: 'tabzen-find-duplicates',
  SAVE_TO_SESSION: 'tabzen-save-session',
  CLOSE_DUPLICATES: 'tabzen-close-duplicates',
} as const;

function createMenuItems(): void {
  chrome.contextMenus.create({
    id: MENU_IDS.MOVE_TO_GROUP,
    title: 'Move to group...',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.MOVE_TO_NEW_GROUP,
    title: 'New group',
    parentId: MENU_IDS.MOVE_TO_GROUP,
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.CREATE_RULE,
    title: 'Create rule from this tab',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.FIND_DUPLICATES,
    title: 'Find duplicates of this',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.SAVE_TO_SESSION,
    title: 'Save to session...',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.CLOSE_DUPLICATES,
    title: 'Close duplicates in window',
    contexts: ['page'],
  });
}

async function updateGroupSubmenu(): Promise<void> {
  // Remove existing group items (except the "New group" item)
  // Then re-add items for each current group
  const windows = await chrome.windows.getAll();
  const allGroups = new Map<string, { id: number; title: string; color: string }>();

  for (const win of windows) {
    if (!win.id) continue;
    const groups = await chrome.tabGroups.query({ windowId: win.id });
    for (const group of groups) {
      const key = `${group.title}::${group.color}`;
      if (!allGroups.has(key)) {
        allGroups.set(key, { id: group.id, title: group.title ?? 'Untitled', color: group.color });
      }
    }
  }

  // Create submenu items for each group
  for (const [key, group] of allGroups) {
    chrome.contextMenus.create({
      id: `tabzen-group-${group.id}`,
      title: group.title || 'Untitled',
      parentId: MENU_IDS.MOVE_TO_GROUP,
      contexts: ['page'],
    });
  }
}

async function handleMenuClick(
  bus: MessageBus,
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (!tab?.id || !tab.windowId) return;

  const menuItemId = String(info.menuItemId);

  // Handle group submenu items
  if (menuItemId.startsWith('tabzen-group-')) {
    const groupId = parseInt(menuItemId.replace('tabzen-group-', ''), 10);
    if (!isNaN(groupId)) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId });
    }
    return;
  }

  switch (menuItemId) {
    case MENU_IDS.MOVE_TO_NEW_GROUP: {
      const groupId = await chrome.tabs.group({
        tabIds: [tab.id],
        createProperties: { windowId: tab.windowId },
      });
      // Name it after the tab's domain
      const domain = tab.url ? extractDomain(tab.url) : null;
      if (domain) {
        await chrome.tabGroups.update(groupId, { title: domain });
      }
      break;
    }

    case MENU_IDS.CREATE_RULE: {
      // Extract domain from tab URL and send as a suggestion
      // The UI will handle showing a dialog to finalize the rule
      if (tab.url) {
        const domain = extractDomain(tab.url);
        if (domain) {
          // This would typically open the side panel or popup with a pre-filled rule form
          // For now, we just return the domain info that the UI can use
          await bus.dispatch({
            action: 'getActiveWorkspace',
          });
        }
      }
      break;
    }

    case MENU_IDS.FIND_DUPLICATES: {
      if (tab.url) {
        await bus.dispatch({
          action: 'searchTabs',
          query: tab.url,
          scope: 'tabs',
        });
      }
      break;
    }

    case MENU_IDS.SAVE_TO_SESSION: {
      await bus.dispatch({
        action: 'saveSession',
        windowId: tab.windowId,
      });
      break;
    }

    case MENU_IDS.CLOSE_DUPLICATES: {
      await bus.dispatch({
        action: 'removeDuplicates',
        windowId: tab.windowId,
      });
      break;
    }
  }
}

export { MENU_IDS, createMenuItems, updateGroupSubmenu, handleMenuClick };

export function registerContextMenus(bus: MessageBus): void {
  // Set up menus on install and startup
  chrome.runtime.onInstalled.addListener(async () => {
    await chrome.contextMenus.removeAll();
    createMenuItems();
  });

  chrome.runtime.onStartup.addListener(async () => {
    await chrome.contextMenus.removeAll();
    createMenuItems();
  });

  // Handle menu clicks
  chrome.contextMenus.onClicked.addListener(
    (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
      handleMenuClick(bus, info, tab);
    },
  );
}
