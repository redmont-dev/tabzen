import type { TabGroupColor, Settings, Workspace } from '@/data/types';

export const TAB_GROUP_COLORS: TabGroupColor[] = [
  'grey', 'blue', 'red', 'yellow', 'green',
  'pink', 'purple', 'cyan', 'orange',
];

export const DEFAULT_SETTINGS: Settings = {
  dedupEnabled: true,
  // Per-window by design: closing or focusing a tab in a window the user is not
  // looking at is disruptive, so widening the net is opt-in.
  dedupScope: 'window',
  stripFragments: true,
  stripTrailingSlash: true,
  protocolAgnostic: true,
  collapseAfterSort: false,
  colorOrder: [...TAB_GROUP_COLORS],
  defaultSortBy: 'title',
  defaultSortOrder: 'asc',
  groupSortMode: 'name',
  removeDupsOnSort: false,
  cleanupSort: true,
  cleanupGroup: true,
  cleanupSortGroups: true,
  cleanupDedup: false,
  cleanupCollapse: false,
  autoSaveSchedule: 'disabled',
  autoSaveDailyTime: '18:00',
  autoSaveOnClose: false,
  autoSaveSkipConfirm: false,
  activeWorkspaceId: 'default',
  telemetryEnabled: false,
  newTabPageEnabled: true,
  theme: 'system',
};

export const DEFAULT_WORKSPACE_SETTINGS = {
  defaultSortBy: 'title' as const,
  defaultSortOrder: 'asc' as const,
  groupSortMode: 'name' as const,
  collapseAfterSort: false,
  removeDupsOnSort: false,
};

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  WORKSPACES: 'workspaces',
  COLOR_ORDER: 'colorOrder',
} as const;

export const NON_RESTORABLE_PROTOCOLS = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
];

export const AUTO_SAVE_ALARM_NAME = 'tabzen-auto-save';
export const SYNC_STATE_KEY = 'tabzen-sync-state';
// Drive sync is feature-flagged off for the v1 store release. Enabling it
// requires a Google OAuth client bound to the published extension ID:
// restore the "oauth2" block and "identity" permission in manifest.json,
// then flip this flag. Targeted for v1.1.
export const DRIVE_SYNC_ENABLED = false;
export const PENDING_ANALYTICS_KEY = 'tabzen-pending-analytics';
export const WINDOW_SNAPSHOT_PREFIX = 'tabzen-window-snapshot-';
export const PENDING_SEARCH_KEY = 'tabzen-pending-search';
// Ids of the dynamically-built "Move to group..." submenu items
export const GROUP_MENU_IDS_KEY = 'tabzen-group-menu-ids';
// Long-lived port UI pages use to receive real-time window updates
export const PORT_NAME = 'tabzen-ui';
// Per-window MRU tab history backing the "previous tab" shortcut
export const TAB_HISTORY_KEY = 'tabzen-tab-history';
export const MAX_TAB_HISTORY = 10;
// Skip save-on-close for trivial windows (single-tab popups, blank windows)
export const MIN_TABS_FOR_CLOSE_SAVE = 2;
// Cap on automatically-created sessions ('auto' and 'close'). Auto-save plus
// save-on-close would otherwise grow IndexedDB without limit. Sessions the user
// saved by hand are never pruned.
//
// At ~4KB per session this is ~1.6MB — over a year of daily saves, or a couple
// of weeks of hourly ones. Sized as a backstop rather than a limit you feel:
// skipping unchanged snapshots is what keeps the count down day to day.
export const MAX_AUTO_SESSIONS = 400;

// How many sessions each surface asks for. Sessions run ~4KB each and cross the
// message boundary by structured clone, so fetching the whole store to render
// five rows costs megabytes per popup open. Every UI asks for what it draws.
export const POPUP_RECENT_SESSIONS = 5;
export const SESSION_LIST_PAGE = 25;
// Search projects each session to one flat string before indexing; without a
// bound this rebuilds an index over every tab of every session per keystroke.
export const SESSION_SEARCH_LIMIT = 100;
export const SESSION_SEARCH_TABS_PER_SESSION = 50;

export function createDefaultWorkspace(): Workspace {
  return {
    id: 'default',
    name: 'Default',
    icon: '',
    rules: [],
    priorityRules: [],
    settings: { ...DEFAULT_WORKSPACE_SETTINGS },
    windowIds: [],
    createdAt: Date.now(),
  };
}

export const MAX_ANALYTICS_DAYS = 90;
export const ANALYTICS_SNAPSHOT_INTERVAL = 30; // minutes
export const ANALYTICS_ALARM_NAME = 'tabzen-analytics-snapshot';
export const INDEXEDDB_NAME = 'tabzen';
export const INDEXEDDB_VERSION = 1;
