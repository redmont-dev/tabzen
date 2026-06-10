import type { MessageBus } from '../message-bus';
import type { GroupingRule, Workspace } from '@/data/types';
import { extractDomain } from '../utils/rule-matcher';
import { notify } from '../utils/notify';
import { SessionStorage } from '@/data/storage';
import { TAB_GROUP_COLORS, PENDING_SEARCH_KEY } from '@/shared/constants';

const MENU_IDS = {
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
      if (!tab.url) break;
      const domain = extractDomain(tab.url);
      if (!domain) break;

      const wsResponse = await bus.dispatch({ action: 'getActiveWorkspace' });
      if (!wsResponse.ok || !wsResponse.data) {
        notify('Could not create rule', wsResponse.error ?? 'No active workspace found.');
        break;
      }
      const workspace = wsResponse.data as Workspace;

      if (workspace.rules.some(r => r.type === 'domain' && r.pattern === domain)) {
        notify('Rule already exists', `"${domain}" is already covered by a rule in ${workspace.name}.`);
        break;
      }

      const rule: GroupingRule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'domain',
        pattern: domain,
        groupName: domain,
        color: TAB_GROUP_COLORS[workspace.rules.length % TAB_GROUP_COLORS.length],
        enabled: true,
        source: 'user',
      };

      const updateResponse = await bus.dispatch({
        action: 'updateWorkspace',
        workspaceId: workspace.id,
        updates: { rules: [...workspace.rules, rule] },
      });
      if (!updateResponse.ok) {
        notify('Could not create rule', updateResponse.error ?? 'Unknown error');
        break;
      }

      await bus.dispatch({ action: 'applyRules', windowId: tab.windowId });
      notify('Rule created', `Tabs from ${domain} will be grouped into "${domain}".`);
      break;
    }

    case MENU_IDS.FIND_DUPLICATES: {
      if (!tab.url) break;
      // Hand the query to the side panel, then open it (the menu click is a
      // user gesture, which sidePanel.open requires)
      await SessionStorage.set(PENDING_SEARCH_KEY, tab.url);
      await chrome.sidePanel.open({ windowId: tab.windowId });
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

export { MENU_IDS, createMenuItems, handleMenuClick };

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
      handleMenuClick(bus, info, tab).catch(err => console.error('Menu action failed:', err));
    },
  );
}
