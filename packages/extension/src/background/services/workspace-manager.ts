import type { MessageBus } from '../message-bus';
import type { Workspace, Settings } from '@/data/types';
import { LocalStorage, SyncStorage } from '@/data/storage';
import {
  DEFAULT_SETTINGS,
  DEFAULT_WORKSPACE_SETTINGS,
  STORAGE_KEYS,
  createDefaultWorkspace,
} from '@/shared/constants';

function generateId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getWorkspaces(): Promise<Workspace[]> {
  const workspaces = await LocalStorage.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
  if (workspaces.length === 0) {
    const defaultWs = createDefaultWorkspace();
    await LocalStorage.set(STORAGE_KEYS.WORKSPACES, [defaultWs]);
    return [defaultWs];
  }
  return workspaces;
}

async function getSettings(): Promise<Settings> {
  return SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

async function getActiveWorkspace(): Promise<Workspace> {
  const settings = await getSettings();
  const workspaces = await getWorkspaces();
  const active = workspaces.find(w => w.id === settings.activeWorkspaceId);
  if (active) return active;
  // Fallback: return first workspace (which is the default)
  return workspaces[0];
}

async function createWorkspace(name: string, icon?: string): Promise<Workspace> {
  const workspaces = await getWorkspaces();
  const workspace: Workspace = {
    id: generateId(),
    name,
    icon: icon ?? '',
    rules: [],
    priorityRules: [],
    settings: { ...DEFAULT_WORKSPACE_SETTINGS },
    windowIds: [],
    createdAt: Date.now(),
  };
  workspaces.push(workspace);
  await LocalStorage.set(STORAGE_KEYS.WORKSPACES, workspaces);
  return workspace;
}

async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<Workspace, 'name' | 'icon' | 'rules' | 'priorityRules' | 'settings' | 'windowIds'>>,
): Promise<Workspace> {
  const workspaces = await getWorkspaces();
  const index = workspaces.findIndex(w => w.id === workspaceId);
  if (index === -1) {
    throw new Error(`Workspace "${workspaceId}" not found`);
  }
  const updated = { ...workspaces[index], ...updates };
  workspaces[index] = updated;
  await LocalStorage.set(STORAGE_KEYS.WORKSPACES, workspaces);
  return updated;
}

async function deleteWorkspace(workspaceId: string): Promise<void> {
  const workspaces = await getWorkspaces();
  const index = workspaces.findIndex(w => w.id === workspaceId);
  if (index === -1) {
    throw new Error(`Workspace "${workspaceId}" not found`);
  }
  if (workspaces.length <= 1) {
    throw new Error('Cannot delete the last workspace');
  }
  workspaces.splice(index, 1);
  await LocalStorage.set(STORAGE_KEYS.WORKSPACES, workspaces);

  // If the deleted workspace was active, switch to the first remaining one
  const settings = await getSettings();
  if (settings.activeWorkspaceId === workspaceId) {
    await SyncStorage.set(STORAGE_KEYS.SETTINGS, {
      ...settings,
      activeWorkspaceId: workspaces[0].id,
    });
  }
}

async function switchWorkspace(
  workspaceId: string,
  fullSwitch: boolean,
  windowId: number,
  applyRulesFn?: (windowId: number) => Promise<void>,
): Promise<void> {
  const workspaces = await getWorkspaces();
  const target = workspaces.find(w => w.id === workspaceId);
  if (!target) {
    throw new Error(`Workspace "${workspaceId}" not found`);
  }

  const settings = await getSettings();

  // Update active workspace ID
  await SyncStorage.set(STORAGE_KEYS.SETTINGS, {
    ...settings,
    activeWorkspaceId: workspaceId,
  });

  if (fullSwitch) {
    // Full switch: save current window's association to old workspace,
    // then create/restore target workspace window
    const oldWorkspaceId = settings.activeWorkspaceId;
    const oldIndex = workspaces.findIndex(w => w.id === oldWorkspaceId);
    if (oldIndex !== -1) {
      // Remove windowId from old workspace
      workspaces[oldIndex] = {
        ...workspaces[oldIndex],
        windowIds: workspaces[oldIndex].windowIds.filter(id => id !== windowId),
      };
    }

    // Add windowId to target workspace (if not already there)
    const targetIndex = workspaces.findIndex(w => w.id === workspaceId);
    if (!workspaces[targetIndex].windowIds.includes(windowId)) {
      workspaces[targetIndex] = {
        ...workspaces[targetIndex],
        windowIds: [...workspaces[targetIndex].windowIds, windowId],
      };
    }

    await LocalStorage.set(STORAGE_KEYS.WORKSPACES, workspaces);
  }

  // Re-apply rules for the new workspace
  if (applyRulesFn) {
    await applyRulesFn(windowId);
  }
}

export function registerWorkspaceManager(
  bus: MessageBus,
  applyRulesFn?: (windowId: number) => Promise<void>,
): void {
  bus.register('getWorkspaces', async () => {
    const workspaces = await getWorkspaces();
    return { ok: true, data: workspaces };
  });

  bus.register('getActiveWorkspace', async () => {
    const workspace = await getActiveWorkspace();
    return { ok: true, data: workspace };
  });

  bus.register('createWorkspace', async (req) => {
    const workspace = await createWorkspace(req.name, req.icon);
    return { ok: true, data: workspace };
  });

  bus.register('updateWorkspace', async (req) => {
    const workspace = await updateWorkspace(req.workspaceId, req.updates);
    return { ok: true, data: workspace };
  });

  bus.register('deleteWorkspace', async (req) => {
    await deleteWorkspace(req.workspaceId);
    return { ok: true };
  });

  bus.register('switchWorkspace', async (req) => {
    await switchWorkspace(req.workspaceId, req.fullSwitch, req.windowId, applyRulesFn);
    return { ok: true };
  });
}
