import type { TabGroupColor, Settings } from '@/data/types';

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
  autoSaveCountdown: 15,
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

export const MAX_ANALYTICS_DAYS = 90;
export const INDEXEDDB_NAME = 'tabzen';
export const INDEXEDDB_VERSION = 1;
