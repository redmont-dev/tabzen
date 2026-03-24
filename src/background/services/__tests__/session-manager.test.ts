import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { MessageBus } from '../../message-bus';
import { registerSessionManager } from '../session-manager';
import { DEFAULT_SETTINGS, STORAGE_KEYS, AUTO_SAVE_ALARM_NAME } from '@/shared/constants';
import type { Session } from '@/data/types';

describe('SessionManager', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    bus = new MessageBus();
    await registerSessionManager(bus);
    vi.clearAllMocks();

    // Reset storage
    const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];
  });

  describe('saveSession', () => {
    it('saves current window tabs as a session', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Tab 2', url: 'https://other.com', index: 1, windowId: 1, groupId: 10, pinned: true },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]);

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'My Session' });
      expect(result.ok).toBe(true);

      const session = result.data as Session;
      expect(session.name).toBe('My Session');
      expect(session.source).toBe('manual');
      expect(session.tabs).toHaveLength(2);
      expect(session.tabs[0].url).toBe('https://example.com');
      expect(session.tabs[1].pinned).toBe(true);
      expect(session.groups).toHaveLength(1);
      expect(session.groups[0].title).toBe('Work');
    });

    it('filters out non-restorable URLs', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Normal', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Chrome Settings', url: 'chrome://settings', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Extension', url: 'chrome-extension://abc/page.html', index: 2, windowId: 1, groupId: -1, pinned: false },
        { id: 4, title: 'About', url: 'about:blank', index: 3, windowId: 1, groupId: -1, pinned: false },
        { id: 5, title: 'Edge', url: 'edge://settings', index: 4, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1 });
      const session = result.data as Session;
      expect(session.tabs).toHaveLength(1);
      expect(session.tabs[0].url).toBe('https://example.com');
    });

    it('generates a default name with timestamp when none provided', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1 });
      const session = result.data as Session;
      expect(session.name).toMatch(/^Session /);
    });

    it('saves with custom source label', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });
      const session = result.data as Session;
      expect(session.source).toBe('auto');
    });
  });

  describe('getSessions', () => {
    it('returns all saved sessions', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'Session A' });
      await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'Session B' });

      const result = await bus.dispatch({ action: 'getSessions' });
      expect(result.ok).toBe(true);
      const sessions = result.data as Session[];
      expect(sessions).toHaveLength(2);
    });
  });

  describe('getSession', () => {
    it('returns a specific session by ID', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const saveResult = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'Test' });
      const saved = saveResult.data as Session;

      const result = await bus.dispatch({ action: 'getSession', sessionId: saved.id });
      expect(result.ok).toBe(true);
      expect((result.data as Session).name).toBe('Test');
    });

    it('returns error for non-existent session', async () => {
      const result = await bus.dispatch({ action: 'getSession', sessionId: 'nonexistent' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('restoreSession', () => {
    it('creates a new window with session tabs', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'https://a.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Tab 2', url: 'https://b.com', index: 1, windowId: 1, groupId: 10, pinned: true },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]);

      const saveResult = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'Test' });
      const session = saveResult.data as Session;

      vi.mocked(chrome.windows.create).mockResolvedValue({ id: 2 } as chrome.windows.Window);
      vi.mocked(chrome.tabs.create).mockImplementation(async (props) => ({
        id: Math.floor(Math.random() * 1000),
        ...props,
      } as chrome.tabs.Tab));
      vi.mocked(chrome.tabs.group).mockResolvedValue(20);

      const result = await bus.dispatch({ action: 'restoreSession', sessionId: session.id });
      expect(result.ok).toBe(true);

      // Should create a new window
      expect(chrome.windows.create).toHaveBeenCalled();
      // Should create tabs
      expect(chrome.tabs.create).toHaveBeenCalled();
    });

    it('returns error for non-existent session', async () => {
      const result = await bus.dispatch({ action: 'restoreSession', sessionId: 'nonexistent' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('restoreSessionTabs', () => {
    it('opens specific tabs from a session in the current window', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab A', url: 'https://a.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Tab B', url: 'https://b.com', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Tab C', url: 'https://c.com', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const saveResult = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'Multi' });
      const session = saveResult.data as Session;

      vi.mocked(chrome.tabs.create).mockImplementation(async (props) => ({
        id: Math.floor(Math.random() * 1000),
        ...props,
      } as chrome.tabs.Tab));

      // Restore only tabs at index 0 and 2
      const result = await bus.dispatch({
        action: 'restoreSessionTabs',
        sessionId: session.id,
        tabIndices: [0, 2],
      });

      expect(result.ok).toBe(true);
      expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
      // First call should be for Tab A (https://a.com)
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://a.com' }),
      );
      // Second call should be for Tab C (https://c.com)
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://c.com' }),
      );
    });

    it('returns error for non-existent session', async () => {
      const result = await bus.dispatch({
        action: 'restoreSessionTabs',
        sessionId: 'nonexistent',
        tabIndices: [0],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('deletes a session', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const saveResult = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'ToDelete' });
      const session = saveResult.data as Session;

      const result = await bus.dispatch({ action: 'deleteSession', sessionId: session.id });
      expect(result.ok).toBe(true);

      const getResult = await bus.dispatch({ action: 'getSession', sessionId: session.id });
      expect(getResult.ok).toBe(false);
    });
  });

  describe('renameSession', () => {
    it('renames a session', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const saveResult = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'Old Name' });
      const session = saveResult.data as Session;

      const result = await bus.dispatch({ action: 'renameSession', sessionId: session.id, name: 'New Name' });
      expect(result.ok).toBe(true);

      const getResult = await bus.dispatch({ action: 'getSession', sessionId: session.id });
      expect((getResult.data as Session).name).toBe('New Name');
    });

    it('returns error for non-existent session', async () => {
      const result = await bus.dispatch({ action: 'renameSession', sessionId: 'nonexistent', name: 'Test' });
      expect(result.ok).toBe(false);
    });
  });

  describe('configureAutoSave', () => {
    it('creates an hourly alarm when autoSaveSchedule is hourly', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = {
        ...DEFAULT_SETTINGS,
        autoSaveSchedule: 'hourly',
      };

      const result = await bus.dispatch({ action: 'configureAutoSave' });
      expect(result.ok).toBe(true);
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        AUTO_SAVE_ALARM_NAME,
        expect.objectContaining({ periodInMinutes: 60 }),
      );
    });

    it('creates a daily alarm when autoSaveSchedule is daily', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = {
        ...DEFAULT_SETTINGS,
        autoSaveSchedule: 'daily',
        autoSaveDailyTime: '14:00',
      };

      const result = await bus.dispatch({ action: 'configureAutoSave' });
      expect(result.ok).toBe(true);
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        AUTO_SAVE_ALARM_NAME,
        expect.objectContaining({ periodInMinutes: 1440 }),
      );
    });

    it('clears alarm when autoSaveSchedule is disabled', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = {
        ...DEFAULT_SETTINGS,
        autoSaveSchedule: 'disabled',
      };

      const result = await bus.dispatch({ action: 'configureAutoSave' });
      expect(result.ok).toBe(true);
      expect(chrome.alarms.clear).toHaveBeenCalledWith(AUTO_SAVE_ALARM_NAME);
    });
  });

  describe('URL filtering', () => {
    it('saves tabs with valid URLs only', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Good', url: 'https://good.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'New Tab', url: 'chrome://newtab/', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Also Good', url: 'http://also-good.com', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1 });
      const session = result.data as Session;
      expect(session.tabs).toHaveLength(2);
      expect(session.tabs.every(t => t.url.startsWith('http'))).toBe(true);
    });
  });
});
