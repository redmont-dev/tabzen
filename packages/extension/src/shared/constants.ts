import type { TabGroupColor, Settings, Workspace } from '@/data/types';

export const TAB_GROUP_COLORS: TabGroupColor[] = [
  'grey', 'blue', 'red', 'yellow', 'green',
  'pink', 'purple', 'cyan', 'orange',
];

export const DEFAULT_SETTINGS: Settings = {
  dedupEnabled: true,
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
  cleanupSortGroups: false,
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
// Skip save-on-close for trivial windows (single-tab popups, blank windows)
export const MIN_TABS_FOR_CLOSE_SAVE = 2;

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
