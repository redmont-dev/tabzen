import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../message-bus';
import { registerWorkspaceManager } from '../workspace-manager';
import { DEFAULT_SETTINGS, STORAGE_KEYS, createDefaultWorkspace } from '@/shared/constants';
import type { Workspace } from '@/data/types';

describe('WorkspaceManager', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    bus = new MessageBus();
    const applyRules = vi.fn(async () => {});
    registerWorkspaceManager(bus, applyRules);
    vi.clearAllMocks();

    // Reset storage
    const { storageLocalData, storageSyncData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
  });

  describe('getWorkspaces', () => {
    it('returns default workspace when none exist', async () => {
      const result = await bus.dispatch({ action: 'getWorkspaces' });
      expect(result.ok).toBe(true);
      const workspaces = result.data as Workspace[];
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].id).toBe('default');
      expect(workspaces[0].name).toBe('Default');
    });

    it('returns existing workspaces from storage', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[STORAGE_KEYS.WORKSPACES] = [
        { ...createDefaultWorkspace(), id: 'w1', name: 'Work' },
        { ...createDefaultWorkspace(), id: 'w2', name: 'Personal' },
      ];

      const result = await bus.dispatch({ action: 'getWorkspaces' });
      expect(result.ok).toBe(true);
      const workspaces = result.data as Workspace[];
      expect(workspaces).toHaveLength(2);
      expect(workspaces[0].name).toBe('Work');
    });
  });

  describe('getActiveWorkspace', () => {
    it('returns the active workspace based on settings', async () => {
      const { storageLocalData, storageSyncData } = await import('../../../../tests/setup');
      const ws = { ...createDefaultWorkspace(), id: 'w1', name: 'Work' };
      storageLocalData[STORAGE_KEYS.WORKSPACES] = [ws];
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, activeWorkspaceId: 'w1' };

      const result = await bus.dispatch({ action: 'getActiveWorkspace' });
      expect(result.ok).toBe(true);
      expect((result.data as Workspace).name).toBe('Work');
    });

    it('falls back to default workspace if active ID not found', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, activeWorkspaceId: 'nonexistent' };

      const result = await bus.dispatch({ action: 'getActiveWorkspace' });
      expect(result.ok).toBe(true);
      expect((result.data as Workspace).id).toBe('default');
    });
  });

  describe('createWorkspace', () => {
    it('creates a workspace with given name', async () => {
      const result = await bus.dispatch({ action: 'createWorkspace', name: 'Work' });
      expect(result.ok).toBe(true);
      const ws = result.data as Workspace;
      expect(ws.name).toBe('Work');
      expect(ws.id).toBeTruthy();
      expect(ws.rules).toEqual([]);
      expect(ws.settings).toBeDefined();

      // Verify it's persisted
      const listResult = await bus.dispatch({ action: 'getWorkspaces' });
      const workspaces = listResult.data as Workspace[];
      expect(workspaces.some(w => w.name === 'Work')).toBe(true);
    });

    it('creates a workspace with custom icon', async () => {
      const result = await bus.dispatch({ action: 'createWorkspace', name: 'Fun', icon: 'star' });
      expect(result.ok).toBe(true);
      expect((result.data as Workspace).icon).toBe('star');
    });
  });

  describe('updateWorkspace', () => {
    it('updates workspace name', async () => {
      // Create first
      const createResult = await bus.dispatch({ action: 'createWorkspace', name: 'Old' });
      const ws = createResult.data as Workspace;

      const result = await bus.dispatch({
        action: 'updateWorkspace',
        workspaceId: ws.id,
        updates: { name: 'New' },
      });

      expect(result.ok).toBe(true);
      expect((result.data as Workspace).name).toBe('New');
    });

    it('returns error for non-existent workspace', async () => {
      const result = await bus.dispatch({
        action: 'updateWorkspace',
        workspaceId: 'nonexistent',
        updates: { name: 'Test' },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('deleteWorkspace', () => {
    it('deletes a workspace', async () => {
      // Create two so we can delete one
      await bus.dispatch({ action: 'createWorkspace', name: 'ToDelete' });
      const listBefore = await bus.dispatch({ action: 'getWorkspaces' });
      const workspaces = listBefore.data as Workspace[];
      const toDelete = workspaces.find(w => w.name === 'ToDelete')!;

      const result = await bus.dispatch({ action: 'deleteWorkspace', workspaceId: toDelete.id });
      expect(result.ok).toBe(true);

      const listAfter = await bus.dispatch({ action: 'getWorkspaces' });
      const remaining = listAfter.data as Workspace[];
      expect(remaining.some(w => w.id === toDelete.id)).toBe(false);
    });

    it('prevents deleting the last workspace', async () => {
      // Get the default workspace (only one)
      const listResult = await bus.dispatch({ action: 'getWorkspaces' });
      const workspaces = listResult.data as Workspace[];
      expect(workspaces).toHaveLength(1);

      const result = await bus.dispatch({ action: 'deleteWorkspace', workspaceId: workspaces[0].id });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('last workspace');
    });

    it('returns error for non-existent workspace', async () => {
      const result = await bus.dispatch({ action: 'deleteWorkspace', workspaceId: 'nonexistent' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('switchWorkspace', () => {
    it('performs a soft switch by updating active workspace ID', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS };

      await bus.dispatch({ action: 'createWorkspace', name: 'Work' });
      const listResult = await bus.dispatch({ action: 'getWorkspaces' });
      const workspaces = listResult.data as Workspace[];
      const workWs = workspaces.find(w => w.name === 'Work')!;

      const result = await bus.dispatch({
        action: 'switchWorkspace',
        workspaceId: workWs.id,
        fullSwitch: false,
        windowId: 1,
      });

      expect(result.ok).toBe(true);

      // Verify settings updated
      const settings = storageSyncData[STORAGE_KEYS.SETTINGS] as Record<string, unknown>;
      expect(settings.activeWorkspaceId).toBe(workWs.id);
    });

    it('returns error for non-existent workspace', async () => {
      const result = await bus.dispatch({
        action: 'switchWorkspace',
        workspaceId: 'nonexistent',
        fullSwitch: false,
        windowId: 1,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
