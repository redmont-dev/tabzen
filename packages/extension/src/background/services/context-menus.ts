import type { MessageBus } from '../message-bus';
import type { GroupingRule, Workspace } from '@/data/types';
import { extractDomain } from '../utils/rule-matcher';
import { notify } from '../utils/notify';
import { SessionStorage } from '@/data/storage';
import { TAB_GROUP_COLORS, PENDING_SEARCH_KEY, GROUP_MENU_IDS_KEY } from '@/shared/constants';

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

const GROUP_MENU_PREFIX = 'tabzen-group-';

/**
 * Rebuild the "Move to group..." submenu from the focused window's tab groups.
 *
 * Chrome has no onShown event outside Firefox, so the submenu has to be kept
 * current ahead of the right-click. The ids of the items we created live in
 * chrome.storage.session rather than a module variable: context menus outlive
 * the service worker, so in-memory bookkeeping would be lost on restart and
 * every rebuild would stack duplicates.
 */
async function refreshGroupSubmenu(): Promise<void> {
  const previous = await SessionStorage.get<string[]>(GROUP_MENU_IDS_KEY, []);
  await Promise.all(
    previous.map(id =>
      chrome.contextMenus.remove(id).catch(() => {
        // Already gone — the menu was rebuilt from scratch on startup
      }),
    ),
  );

  let groups: chrome.tabGroups.TabGroup[] = [];
  try {
    const { id: windowId } = await chrome.windows.getLastFocused();
    if (windowId !== undefined) {
      groups = await chrome.tabGroups.query({ windowId });
    }
  } catch {
    // No window to read groups from
  }

  const created: string[] = [];
  for (const group of groups) {
    const id = `${GROUP_MENU_PREFIX}${group.id}`;
    try {
      chrome.contextMenus.create({
        id,
        title: group.title || `Untitled (${group.color})`,
        parentId: MENU_IDS.MOVE_TO_GROUP,
        contexts: ['page'],
      });
      created.push(id);
    } catch {
      // Duplicate id — skip it rather than losing the whole rebuild
    }
  }

  await SessionStorage.set(GROUP_MENU_IDS_KEY, created);
}

// Group changes arrive in bursts (grouping a dozen tabs fires one event each).
// Rebuilding once at the end of the burst is enough.
const SUBMENU_DEBOUNCE_MS = 300;
let submenuTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleGroupSubmenuRefresh(): void {
  if (submenuTimer) clearTimeout(submenuTimer);
  submenuTimer = setTimeout(() => {
    submenuTimer = undefined;
    refreshGroupSubmenu().catch(err => console.warn('Group submenu refresh failed:', err));
  }, SUBMENU_DEBOUNCE_MS);
}

async function handleMenuClick(
  bus: MessageBus,
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (!tab?.id || !tab.windowId) return;

  const menuItemId = String(info.menuItemId);

  // Handle group submenu items
  if (menuItemId.startsWith(GROUP_MENU_PREFIX)) {
    const groupId = parseInt(menuItemId.slice(GROUP_MENU_PREFIX.length), 10);
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

export { MENU_IDS, GROUP_MENU_PREFIX, createMenuItems, handleMenuClick, refreshGroupSubmenu };

export function registerContextMenus(bus: MessageBus): void {
  // Set up menus on install and startup
  chrome.runtime.onInstalled.addListener(async () => {
    await chrome.contextMenus.removeAll();
    createMenuItems();
    await SessionStorage.remove(GROUP_MENU_IDS_KEY);
    scheduleGroupSubmenuRefresh();
  });

  chrome.runtime.onStartup.addListener(async () => {
    await chrome.contextMenus.removeAll();
    createMenuItems();
    await SessionStorage.remove(GROUP_MENU_IDS_KEY);
    scheduleGroupSubmenuRefresh();
  });

  // Keep the submenu in step with the groups that actually exist
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.groupId !== undefined) scheduleGroupSubmenuRefresh();
  });
  chrome.tabs.onRemoved.addListener(() => scheduleGroupSubmenuRefresh());
  chrome.windows.onFocusChanged.addListener(() => scheduleGroupSubmenuRefresh());

  // Handle menu clicks
  chrome.contextMenus.onClicked.addListener(
    (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
      handleMenuClick(bus, info, tab).catch(err => console.error('Menu action failed:', err));
    },
  );
}
