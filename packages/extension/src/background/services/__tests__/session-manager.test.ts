import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { MessageBus } from '../../message-bus';
import { registerSessionManager } from '../session-manager';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  AUTO_SAVE_ALARM_NAME,
  WINDOW_SNAPSHOT_PREFIX,
  MAX_AUTO_SESSIONS,
} from '@/shared/constants';
import type { RecentSessions } from '@/data/types';
import { TabzenDB } from '@/data/indexed-db';
import type { Session } from '@/data/types';

async function registerFreshManager() {
  const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
  await db.open();
  const bus = new MessageBus();
  const { ready } = registerSessionManager(bus, db);
  await ready;
  // Let the startup configureAutoSave chain settle
  await new Promise(resolve => setTimeout(resolve, 0));
  return bus;
}

describe('SessionManager', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    // Reset storage first so registration reads clean settings
    const { storageSyncData, storageLocalData, storageSessionData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];
    for (const k of Object.keys(storageSessionData)) delete storageSessionData[k];

    // Isolated DB per test to avoid leaking state between tests
    const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
    await db.open();
    bus = new MessageBus();
    await registerSessionManager(bus, db);
    // Let the startup configureAutoSave chain settle before clearing mocks
    await new Promise(resolve => setTimeout(resolve, 0));
    vi.clearAllMocks();
  });

  describe('saveSession', () => {
    it('saves current window tabs as a session', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Tab 2', url: 'https://other.com', index: 1, windowId: 1, groupId: 10, pinned: true },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

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
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Normal', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Chrome Settings', url: 'chrome://settings', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Extension', url: 'chrome-extension://abc/page.html', index: 2, windowId: 1, groupId: -1, pinned: false },
        { id: 4, title: 'About', url: 'about:blank', index: 3, windowId: 1, groupId: -1, pinned: false },
        { id: 5, title: 'Edge', url: 'edge://settings', index: 4, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1 });
      const session = result.data as Session;
      expect(session.tabs).toHaveLength(1);
      expect(session.tabs[0].url).toBe('https://example.com');
    });

    it('generates a default name with timestamp when none provided', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1 });
      const session = result.data as Session;
      expect(session.name).toMatch(/^Session /);
    });

    it('saves with custom source label', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });
      const session = result.data as Session;
      expect(session.source).toBe('auto');
    });
  });

  describe('getSessions', () => {
    it('returns all saved sessions', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

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
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

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
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab 1', url: 'https://a.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Tab 2', url: 'https://b.com', index: 1, windowId: 1, groupId: 10, pinned: true },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 10, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));

      const saveResult = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'Test' });
      const session = saveResult.data as Session;

      vi.mocked(chrome.windows.create).mockImplementation(async () => ({ id: 2 } as chrome.windows.Window));
      vi.mocked(chrome.tabs.create).mockImplementation(async (props) => ({
        id: Math.floor(Math.random() * 1000),
        ...props,
      } as chrome.tabs.Tab));
      vi.mocked(chrome.tabs.group).mockImplementation(async () => (20));

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
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab A', url: 'https://a.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'Tab B', url: 'https://b.com', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Tab C', url: 'https://c.com', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

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
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

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
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Tab', url: 'https://example.com', index: 0, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

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

  describe('auto-save startup wiring', () => {
    it('schedules the alarm from persisted settings at registration', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = {
        ...DEFAULT_SETTINGS,
        autoSaveSchedule: 'hourly',
      };

      await registerFreshManager();

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        AUTO_SAVE_ALARM_NAME,
        expect.objectContaining({ periodInMinutes: 60 }),
      );
    });

    it('clears the alarm at registration when auto-save is disabled', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS };

      await registerFreshManager();

      expect(chrome.alarms.clear).toHaveBeenCalledWith(AUTO_SAVE_ALARM_NAME);
      expect(chrome.alarms.create).not.toHaveBeenCalled();
    });

    it('does not reset the alarm countdown on a plain service-worker restart', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoSaveSchedule: 'hourly' };

      // First SW start creates the alarm
      await registerFreshManager();
      expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
      vi.mocked(chrome.alarms.create).mockClear();

      // A later SW restart must leave the existing alarm's countdown intact —
      // re-creating it would push the fire time back to a fresh 60 minutes,
      // so the hourly save would never actually fire.
      await registerFreshManager();
      expect(chrome.alarms.create).not.toHaveBeenCalled();
    });

    it('reschedules the alarm when the user changes the schedule', async () => {
      const { storageSyncData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoSaveSchedule: 'hourly' };

      const freshBus = await registerFreshManager();
      vi.mocked(chrome.alarms.create).mockClear();

      // Explicit settings-change path forces a fresh schedule even though the
      // alarm already exists.
      await freshBus.dispatch({ action: 'configureAutoSave' });
      expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('save-on-close', () => {
    function lastWindowRemovedListener() {
      const calls = vi.mocked(chrome.windows.onRemoved.addListener).mock.calls;
      return calls[calls.length - 1][0] as (windowId: number) => Promise<void>;
    }

    it('saves the cached snapshot as a session when a window closes', async () => {
      const { storageSyncData, storageSessionData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoSaveOnClose: true };
      storageSessionData[`${WINDOW_SNAPSHOT_PREFIX}7`] = {
        tabs: [
          { url: 'https://a.com', title: 'A', pinned: false, groupId: null },
          { url: 'https://b.com', title: 'B', pinned: false, groupId: null },
        ],
        groups: [],
      };

      const freshBus = await registerFreshManager();
      await lastWindowRemovedListener()(7);

      const result = await freshBus.dispatch({ action: 'getSessions' });
      const sessions = result.data as Session[];
      expect(sessions).toHaveLength(1);
      expect(sessions[0].source).toBe('close');
      expect(sessions[0].tabs).toHaveLength(2);
      expect(storageSessionData[`${WINDOW_SNAPSHOT_PREFIX}7`]).toBeUndefined();
      expect(chrome.notifications.create).toHaveBeenCalled();
    });

    it('snapshots already-open windows when save-on-close is configured, so an immediate close still saves', async () => {
      const { storageSyncData, storageSessionData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoSaveOnClose: true };

      // No snapshot pre-seeded: the window's tabs loaded before the toggle was
      // enabled, so no tab event has fired since.
      vi.mocked(chrome.windows.getAll).mockImplementation(async () => ([{ id: 12 }] as chrome.windows.Window[]));
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'A', url: 'https://a.com', windowId: 12, groupId: -1, pinned: false },
        { id: 2, title: 'B', url: 'https://b.com', windowId: 12, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const freshBus = await registerFreshManager();
      // The updateSettings -> configureAutoSave path that runs when the toggle flips on
      await freshBus.dispatch({ action: 'configureAutoSave' });

      expect(storageSessionData[`${WINDOW_SNAPSHOT_PREFIX}12`]).toMatchObject({
        tabs: [
          expect.objectContaining({ url: 'https://a.com' }),
          expect.objectContaining({ url: 'https://b.com' }),
        ],
      });

      await lastWindowRemovedListener()(12);
      const result = await freshBus.dispatch({ action: 'getSessions' });
      const sessions = result.data as Session[];
      expect(sessions).toHaveLength(1);
      expect(sessions[0].source).toBe('close');
    });

    it('skips single-tab windows', async () => {
      const { storageSyncData, storageSessionData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoSaveOnClose: true };
      storageSessionData[`${WINDOW_SNAPSHOT_PREFIX}8`] = {
        tabs: [{ url: 'https://a.com', title: 'A', pinned: false, groupId: null }],
        groups: [],
      };

      const freshBus = await registerFreshManager();
      await lastWindowRemovedListener()(8);

      const result = await freshBus.dispatch({ action: 'getSessions' });
      expect(result.data as Session[]).toHaveLength(0);
      expect(storageSessionData[`${WINDOW_SNAPSHOT_PREFIX}8`]).toBeUndefined();
    });

    it('does nothing when save-on-close is disabled', async () => {
      const { storageSyncData, storageSessionData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoSaveOnClose: false };
      storageSessionData[`${WINDOW_SNAPSHOT_PREFIX}9`] = {
        tabs: [
          { url: 'https://a.com', title: 'A', pinned: false, groupId: null },
          { url: 'https://b.com', title: 'B', pinned: false, groupId: null },
        ],
        groups: [],
      };

      const freshBus = await registerFreshManager();
      await lastWindowRemovedListener()(9);

      const result = await freshBus.dispatch({ action: 'getSessions' });
      expect(result.data as Session[]).toHaveLength(0);
    });

    it('caches a debounced window snapshot after tab events', async () => {
      const { storageSyncData, storageSessionData } = await import('../../../../tests/setup');
      storageSyncData[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS, autoSaveOnClose: true };

      await registerFreshManager();
      const updatedCalls = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls;
      const listener = updatedCalls[updatedCalls.length - 1][0] as (
        tabId: number,
        changeInfo: chrome.tabs.OnUpdatedInfo,
        tab: chrome.tabs.Tab,
      ) => void;

      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'A', url: 'https://a.com', windowId: 3, groupId: -1, pinned: false },
        { id: 2, title: 'B', url: 'https://b.com', windowId: 3, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      vi.useFakeTimers();
      try {
        listener(1, { status: 'complete' }, { windowId: 3 } as chrome.tabs.Tab);
        await vi.advanceTimersByTimeAsync(600);
      } finally {
        vi.useRealTimers();
      }

      expect(storageSessionData[`${WINDOW_SNAPSHOT_PREFIX}3`]).toMatchObject({
        tabs: [
          expect.objectContaining({ url: 'https://a.com' }),
          expect.objectContaining({ url: 'https://b.com' }),
        ],
      });
    });
  });

  describe('URL filtering', () => {
    it('saves tabs with valid URLs only', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, title: 'Good', url: 'https://good.com', index: 0, windowId: 1, groupId: -1, pinned: false },
        { id: 2, title: 'New Tab', url: 'chrome://newtab/', index: 1, windowId: 1, groupId: -1, pinned: false },
        { id: 3, title: 'Also Good', url: 'http://also-good.com', index: 2, windowId: 1, groupId: -1, pinned: false },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([]));

      const result = await bus.dispatch({ action: 'saveSession', windowId: 1 });
      const session = result.data as Session;
      expect(session.tabs).toHaveLength(2);
      expect(session.tabs.every(t => t.url.startsWith('http'))).toBe(true);
    });
  });

  describe('automatic session retention', () => {
    /** A window whose tab list is unique to `n`, so snapshots differ. */
    function windowWith(n: number) {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: `https://a.com/${n}`, title: 'A', pinned: false, groupId: -1 },
      ] as chrome.tabs.Tab[]));
    }

    function seedSession(overrides: Partial<Session>): Session {
      return {
        id: `seed-${Math.random().toString(36).slice(2, 10)}`,
        name: 'seeded',
        workspaceId: null,
        createdAt: 0,
        source: 'auto',
        tabs: [{ url: 'https://seed.example', title: 'seed', pinned: false, groupId: null }],
        groups: [],
        driveFileId: null,
        ...overrides,
      };
    }

    it('prunes down to MAX_AUTO_SESSIONS once the cap is passed', async () => {
      const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
      await db.open();
      const localBus = new MessageBus();
      await registerSessionManager(localBus, db);

      // Seed past the cap directly — saving them one at a time would be a
      // round-trip per session against a 400-deep store.
      for (let i = 0; i < MAX_AUTO_SESSIONS + 5; i++) {
        await db.putSession(seedSession({ name: `auto-${i}`, createdAt: 1000 + i }));
      }

      windowWith(999);
      await localBus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      const sessions = (await db.getAllSessions());
      expect(sessions).toHaveLength(MAX_AUTO_SESSIONS);
      // Oldest went first, newest survived
      const names = sessions.map(x => x.name);
      expect(names).not.toContain('auto-0');
      expect(names).toContain(`auto-${MAX_AUTO_SESSIONS + 4}`);
    });

    it('never prunes sessions the user saved by hand', async () => {
      const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
      await db.open();
      const localBus = new MessageBus();
      await registerSessionManager(localBus, db);

      await db.putSession(seedSession({
        name: 'my important session', source: 'manual', createdAt: 1,
      }));
      for (let i = 0; i < MAX_AUTO_SESSIONS + 5; i++) {
        await db.putSession(seedSession({ name: `auto-${i}`, createdAt: 1000 + i }));
      }

      windowWith(999);
      await localBus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      const names = (await db.getAllSessions()).map(x => x.name);
      expect(names).toContain('my important session');
      expect(names.filter(n => n !== 'my important session')).toHaveLength(MAX_AUTO_SESSIONS);
    });
  });

  describe('skipping unchanged automatic saves', () => {
    function windowWith(urls: string[]) {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => (
        urls.map((url, i) => ({
          id: i + 1, url, title: url, pinned: false, groupId: -1,
        })) as chrome.tabs.Tab[]
      ));
    }

    it('writes nothing when the tab set matches the last automatic save', async () => {
      windowWith(['https://a.com', 'https://b.com']);

      const first = await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });
      const second = await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      expect((first.data as Session).id).toBeTruthy();
      expect(second.ok).toBe(true);
      expect(second.data).toBeNull();

      const all = await bus.dispatch({ action: 'getSessions' });
      expect(all.data as Session[]).toHaveLength(1);
    });

    it('saves again once a tab changes', async () => {
      windowWith(['https://a.com']);
      await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      windowWith(['https://a.com', 'https://b.com']);
      const second = await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      expect(second.data).not.toBeNull();
      const all = await bus.dispatch({ action: 'getSessions' });
      expect(all.data as Session[]).toHaveLength(2);
    });

    it('notices a reordering even when the same tabs are open', async () => {
      windowWith(['https://a.com', 'https://b.com']);
      await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      windowWith(['https://b.com', 'https://a.com']);
      const second = await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      expect(second.data).not.toBeNull();
    });

    it('always honours a manual save, unchanged or not', async () => {
      windowWith(['https://a.com']);
      await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      const manual = await bus.dispatch({ action: 'saveSession', windowId: 1, name: 'mine' });

      expect(manual.data).not.toBeNull();
      const all = await bus.dispatch({ action: 'getSessions' });
      expect(all.data as Session[]).toHaveLength(2);
    });

    it('compares by group name, so a restart renumbering group ids does not count as a change', async () => {
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://a.com', title: 'A', pinned: false, groupId: 7 },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 7, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));
      await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      // Same window, same group, fresh ids after a browser restart
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 1, url: 'https://a.com', title: 'A', pinned: false, groupId: 91 },
      ] as chrome.tabs.Tab[]));
      vi.mocked(chrome.tabGroups.query).mockImplementation(async () => ([
        { id: 91, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]));
      const second = await bus.dispatch({ action: 'saveSession', windowId: 1, source: 'auto' });

      expect(second.data).toBeNull();
    });
  });

  describe('getRecentSessions', () => {
    async function seed(db: TabzenDB, count: number) {
      for (let i = 0; i < count; i++) {
        await db.putSession({
          id: `s${i}`, name: `session-${i}`, workspaceId: null,
          createdAt: 1000 + i, source: 'auto',
          tabs: [{ url: 'https://a.com', title: 'A', pinned: false, groupId: null }],
          groups: [], driveFileId: null,
        });
      }
    }

    it('returns only the requested number, newest first', async () => {
      const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
      await db.open();
      const localBus = new MessageBus();
      await registerSessionManager(localBus, db);
      await seed(db, 10);

      const res = await localBus.dispatch({ action: 'getRecentSessions', limit: 3 });
      const data = res.data as RecentSessions;

      expect(data.sessions).toHaveLength(3);
      expect(data.sessions.map(x => x.name)).toEqual(['session-9', 'session-8', 'session-7']);
    });

    it('reports the full count regardless of the page size', async () => {
      const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
      await db.open();
      const localBus = new MessageBus();
      await registerSessionManager(localBus, db);
      await seed(db, 10);

      const res = await localBus.dispatch({ action: 'getRecentSessions', limit: 3 });
      expect((res.data as RecentSessions).total).toBe(10);
    });

    it('returns the count alone for limit 0, so a collapsed list costs nothing', async () => {
      const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
      await db.open();
      const localBus = new MessageBus();
      await registerSessionManager(localBus, db);
      await seed(db, 10);

      const res = await localBus.dispatch({ action: 'getRecentSessions', limit: 0 });
      const data = res.data as RecentSessions;

      expect(data.sessions).toEqual([]);
      expect(data.total).toBe(10);
    });

    it('handles a limit larger than the store', async () => {
      const db = new TabzenDB(`test-${Math.random().toString(36).slice(2, 10)}`);
      await db.open();
      const localBus = new MessageBus();
      await registerSessionManager(localBus, db);
      await seed(db, 2);

      const res = await localBus.dispatch({ action: 'getRecentSessions', limit: 50 });
      expect((res.data as RecentSessions).sessions).toHaveLength(2);
    });
  });
});