export type TabGroupColor =
  | 'grey' | 'blue' | 'red' | 'yellow' | 'green'
  | 'pink' | 'purple' | 'cyan' | 'orange';

export type RuleType = 'prefix' | 'domain' | 'regex';
export type RuleSource = 'user' | 'pack' | 'suggested';
export type SessionSource = 'manual' | 'auto' | 'close';
export type GroupSortMode = 'name' | 'color';
export type SortBy = 'title' | 'url';
export type SortOrder = 'asc' | 'desc';

export interface GroupingRule {
  id: string;
  type: RuleType;
  pattern: string;
  groupName: string;
  color: TabGroupColor;
  enabled: boolean;
  source: RuleSource;
}

export interface PriorityRule {
  id: string;
  urlPrefix: string;
  colors: TabGroupColor[];
}

export interface WorkspaceSettings {
  defaultSortBy: SortBy;
  defaultSortOrder: SortOrder;
  groupSortMode: GroupSortMode;
  collapseAfterSort: boolean;
  removeDupsOnSort: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  rules: GroupingRule[];
  priorityRules: PriorityRule[];
  settings: WorkspaceSettings;
  windowIds: number[];
  createdAt: number;
}

export interface SessionTab {
  url: string;
  title: string;
  pinned: boolean;
  groupId: number | null;
}

export interface SessionGroup {
  id: number;
  title: string;
  color: TabGroupColor;
  collapsed: boolean;
}

export interface Session {
  id: string;
  name: string;
  workspaceId: string | null;
  createdAt: number;
  source: SessionSource;
  tabs: SessionTab[];
  groups: SessionGroup[];
  driveFileId: string | null;
}

export interface RulePack {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  rules: GroupingRule[];
  priorityRules: PriorityRule[];
}

export interface AnalyticsSnapshot {
  timestamp: number;
  tabCount: number;
  groupCount: number;
  workspaceId: string;
  topDomains: { domain: string; count: number }[];
  duplicatesBlocked: number;
  sessionsUsed: number;
}

export interface Settings {
  dedupEnabled: boolean;
  stripFragments: boolean;
  stripTrailingSlash: boolean;
  protocolAgnostic: boolean;
  collapseAfterSort: boolean;
  colorOrder: TabGroupColor[];
  defaultSortBy: SortBy;
  defaultSortOrder: SortOrder;
  groupSortMode: GroupSortMode;
  removeDupsOnSort: boolean;
  cleanupSort: boolean;
  cleanupGroup: boolean;
  cleanupSortGroups: boolean;
  cleanupDedup: boolean;
  cleanupCollapse: boolean;
  autoSaveSchedule: 'disabled' | 'hourly' | 'daily';
  autoSaveDailyTime: string;
  autoSaveOnClose: boolean;
  autoSaveCountdown: number;
  autoSaveSkipConfirm: boolean;
  activeWorkspaceId: string;
  telemetryEnabled: boolean;
  newTabPageEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
}
