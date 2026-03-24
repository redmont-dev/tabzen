import type {
  GroupingRule, PriorityRule, Session, Workspace, RulePack,
  Settings, SortBy, SortOrder, GroupSortMode, SessionSource,
  WorkspaceSettings, AnalyticsTimeRange,
} from '@/data/types';

interface SortTabsRequest { action: 'sortTabs'; windowId: number; sortBy: SortBy; sortOrder: SortOrder; groupId?: number; }
interface RemoveDuplicatesRequest { action: 'removeDuplicates'; windowId: number; }
interface SortGroupsRequest { action: 'sortGroups'; windowId: number; mode: GroupSortMode; }
interface CollapseAllRequest { action: 'collapseAll'; windowId: number; }
interface SaveSessionRequest { action: 'saveSession'; windowId: number; name?: string; source?: SessionSource; }
interface RestoreSessionRequest { action: 'restoreSession'; sessionId: string; }
interface RestoreSessionTabsRequest { action: 'restoreSessionTabs'; sessionId: string; tabIndices: number[]; }
interface DeleteSessionRequest { action: 'deleteSession'; sessionId: string; }
interface RenameSessionRequest { action: 'renameSession'; sessionId: string; name: string; }
interface GetSessionsRequest { action: 'getSessions'; }
interface GetSessionRequest { action: 'getSession'; sessionId: string; }
interface ApplyRulesRequest { action: 'applyRules'; windowId: number; }
interface CleanUpRequest { action: 'cleanUp'; windowId: number; }
interface GetWindowInfoRequest { action: 'getWindowInfo'; windowId: number; }
interface GetSettingsRequest { action: 'getSettings'; }
interface UpdateSettingsRequest { action: 'updateSettings'; settings: Partial<Settings>; }
interface GetWorkspacesRequest { action: 'getWorkspaces'; }
interface GetActiveWorkspaceRequest { action: 'getActiveWorkspace'; }
interface CreateWorkspaceRequest { action: 'createWorkspace'; name: string; icon?: string; }
interface UpdateWorkspaceRequest { action: 'updateWorkspace'; workspaceId: string; updates: Partial<Pick<Workspace, 'name' | 'icon' | 'rules' | 'priorityRules' | 'settings' | 'windowIds'>>; }
interface DeleteWorkspaceRequest { action: 'deleteWorkspace'; workspaceId: string; }
interface SwitchWorkspaceRequest { action: 'switchWorkspace'; workspaceId: string; fullSwitch: boolean; windowId: number; }
interface ConfigureAutoSaveRequest { action: 'configureAutoSave'; }
interface SearchTabsRequest { action: 'searchTabs'; query: string; scope: 'tabs' | 'sessions' | 'all'; }
interface PingRequest { action: 'ping'; }
interface GetSuggestedRulesRequest { action: 'getSuggestedRules'; windowId: number; }

// Analytics messages
interface GetAnalyticsRequest { action: 'getAnalytics'; from: number; to: number; }
interface GetDashboardStatsRequest { action: 'getDashboardStats'; range: AnalyticsTimeRange; }
interface IncrementAnalyticsCounterRequest { action: 'incrementAnalyticsCounter'; metric: 'duplicatesBlocked' | 'sessionsUsed'; amount?: number; }
interface TakeAnalyticsSnapshotRequest { action: 'takeAnalyticsSnapshot'; }

// Rule pack messages
interface GetBuiltInPacksRequest { action: 'getBuiltInPacks'; }
interface ImportRulePackRequest { action: 'importRulePack'; pack: RulePack; }
interface ExportRulesRequest { action: 'exportRules'; name: string; description?: string; }

export type MessageRequest =
  | SortTabsRequest | RemoveDuplicatesRequest | SortGroupsRequest | CollapseAllRequest
  | SaveSessionRequest | RestoreSessionRequest | RestoreSessionTabsRequest
  | DeleteSessionRequest | RenameSessionRequest | GetSessionsRequest | GetSessionRequest
  | ApplyRulesRequest | CleanUpRequest | GetWindowInfoRequest | GetSettingsRequest
  | UpdateSettingsRequest | GetWorkspacesRequest | GetActiveWorkspaceRequest
  | CreateWorkspaceRequest | UpdateWorkspaceRequest | DeleteWorkspaceRequest
  | SwitchWorkspaceRequest | ConfigureAutoSaveRequest | SearchTabsRequest
  | PingRequest | GetSuggestedRulesRequest
  | GetAnalyticsRequest | GetDashboardStatsRequest | IncrementAnalyticsCounterRequest
  | TakeAnalyticsSnapshotRequest
  | GetBuiltInPacksRequest | ImportRulePackRequest | ExportRulesRequest;

export type MessageAction = MessageRequest['action'];

export interface MessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type MessageHandler<R extends MessageRequest = MessageRequest> =
  (request: R) => Promise<MessageResponse>;
