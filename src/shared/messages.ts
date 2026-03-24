import type {
  GroupingRule, PriorityRule, Session, Workspace,
  Settings, SortBy, SortOrder, GroupSortMode,
} from '@/data/types';

interface SortTabsRequest { action: 'sortTabs'; windowId: number; sortBy: SortBy; sortOrder: SortOrder; groupId?: number; }
interface RemoveDuplicatesRequest { action: 'removeDuplicates'; windowId: number; }
interface SortGroupsRequest { action: 'sortGroups'; windowId: number; mode: GroupSortMode; }
interface CollapseAllRequest { action: 'collapseAll'; windowId: number; }
interface SaveSessionRequest { action: 'saveSession'; windowId: number; name?: string; }
interface RestoreSessionRequest { action: 'restoreSession'; sessionId: string; }
interface DeleteSessionRequest { action: 'deleteSession'; sessionId: string; }
interface RenameSessionRequest { action: 'renameSession'; sessionId: string; name: string; }
interface ApplyRulesRequest { action: 'applyRules'; windowId: number; }
interface CleanUpRequest { action: 'cleanUp'; windowId: number; }
interface GetWindowInfoRequest { action: 'getWindowInfo'; windowId: number; }
interface GetSettingsRequest { action: 'getSettings'; }
interface UpdateSettingsRequest { action: 'updateSettings'; settings: Partial<Settings>; }
interface GetWorkspacesRequest { action: 'getWorkspaces'; }
interface SwitchWorkspaceRequest { action: 'switchWorkspace'; workspaceId: string; fullSwitch: boolean; windowId: number; }
interface SearchTabsRequest { action: 'searchTabs'; query: string; scope: 'tabs' | 'sessions' | 'all'; }
interface PingRequest { action: 'ping'; }

export type MessageRequest =
  | SortTabsRequest | RemoveDuplicatesRequest | SortGroupsRequest | CollapseAllRequest
  | SaveSessionRequest | RestoreSessionRequest | DeleteSessionRequest | RenameSessionRequest
  | ApplyRulesRequest | CleanUpRequest | GetWindowInfoRequest | GetSettingsRequest
  | UpdateSettingsRequest | GetWorkspacesRequest | SwitchWorkspaceRequest | SearchTabsRequest
  | PingRequest;

export type MessageAction = MessageRequest['action'];

export interface MessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type MessageHandler<R extends MessageRequest = MessageRequest> =
  (request: R) => Promise<MessageResponse>;
