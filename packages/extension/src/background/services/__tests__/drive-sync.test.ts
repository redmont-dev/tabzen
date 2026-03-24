import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { MessageBus } from '../../message-bus';
import { registerDriveSync, backupSessionIfEnabled } from '../drive-sync';
import { TabzenDB } from '@/data/indexed-db';
import { SYNC_STATE_KEY } from '@/shared/constants';
import type { Session, SyncStatus } from '@/data/types';

// Mock fetch globally
let mockFetch: ReturnType<typeof vi.fn>;

function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Session',
    workspaceId: null,
    createdAt: Date.now(),
    source: 'manual',
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false, groupId: null }],
    groups: [],
    driveFileId: null,
    ...overrides,
  };
}

describe('DriveSync', () => {
  let bus: MessageBus;
  let db: TabzenDB;

  beforeEach(async () => {
    bus = new MessageBus();
    db = new TabzenDB(`drive-sync-test-${Math.random().toString(36).slice(2, 8)}`);
    await db.open();
    await registerDriveSync(bus, db);

    vi.clearAllMocks();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    // Reset storage
    const { storageLocalData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];
  });

  describe('enableSync', () => {
    it('requests auth token and stores enabled state', async () => {
      const result = await bus.dispatch({ action: 'enableSync' });
      expect(result.ok).toBe(true);
      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith({ interactive: true });

      // Verify sync state stored
      const { storageLocalData } = await import('../../../../tests/setup');
      const state = storageLocalData[SYNC_STATE_KEY] as { enabled: boolean };
      expect(state.enabled).toBe(true);
    });
  });

  describe('disableSync', () => {
    it('revokes token, clears state, and removes driveFileIds', async () => {
      // Setup: enable sync first and add a session with driveFileId
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: 1000 };

      const session = createSession({ driveFileId: 'drive-123' });
      await db.putSession(session);

      // Mock getAuthToken for non-interactive call during disable
      vi.mocked(chrome.identity.getAuthToken).mockResolvedValue({ token: 'cached-token' } as chrome.identity.GetAuthTokenResult);

      const result = await bus.dispatch({ action: 'disableSync' });
      expect(result.ok).toBe(true);

      // Token should be removed
      expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith({ token: 'cached-token' });

      // Sync state should be cleared
      const state = storageLocalData[SYNC_STATE_KEY] as { enabled: boolean };
      expect(state.enabled).toBe(false);

      // driveFileId should be cleared from session
      const updated = await db.getSession(session.id);
      expect(updated?.driveFileId).toBeNull();
    });
  });

  describe('getSyncStatus', () => {
    it('returns disabled status by default', async () => {
      const result = await bus.dispatch({ action: 'getSyncStatus' });
      expect(result.ok).toBe(true);
      const status = result.data as SyncStatus;
      expect(status.enabled).toBe(false);
      expect(status.lastSyncTime).toBeNull();
      expect(status.sessionCount).toBe(0);
    });

    it('returns enabled status with session count', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: 5000 };

      const s1 = createSession({ driveFileId: 'drive-1' });
      const s2 = createSession({ driveFileId: null });
      const s3 = createSession({ driveFileId: 'drive-3' });
      await db.putSession(s1);
      await db.putSession(s2);
      await db.putSession(s3);

      const result = await bus.dispatch({ action: 'getSyncStatus' });
      const status = result.data as SyncStatus;
      expect(status.enabled).toBe(true);
      expect(status.lastSyncTime).toBe(5000);
      expect(status.sessionCount).toBe(2);
    });
  });

  describe('syncSessions', () => {
    it('returns error when sync is not enabled', async () => {
      const result = await bus.dispatch({ action: 'syncSessions' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('uploads all sessions to Drive', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: null };

      vi.mocked(chrome.identity.getAuthToken).mockResolvedValue({ token: 'test-token' } as chrome.identity.GetAuthTokenResult);

      const s1 = createSession({ id: 'sess-1' });
      const s2 = createSession({ id: 'sess-2', driveFileId: 'existing-drive-id' });
      await db.putSession(s1);
      await db.putSession(s2);

      // Mock: createFile for s1, updateFile for s2
      mockFetch
        .mockResolvedValueOnce(mockResponse({ id: 'new-drive-id', name: 'test.json', mimeType: 'application/json' })) // create
        .mockResolvedValueOnce(mockResponse({ id: 'existing-drive-id', name: 'test.json', mimeType: 'application/json' })); // update

      const result = await bus.dispatch({ action: 'syncSessions' });
      expect(result.ok).toBe(true);
      expect((result.data as { synced: number }).synced).toBe(2);

      // s1 should now have driveFileId
      const updated = await db.getSession('sess-1');
      expect(updated?.driveFileId).toBe('new-drive-id');

      // lastSyncTime should be set
      const state = storageLocalData[SYNC_STATE_KEY] as { lastSyncTime: number };
      expect(state.lastSyncTime).toBeGreaterThan(0);
    });
  });

  describe('importFromDrive', () => {
    it('returns error when sync is not enabled', async () => {
      const result = await bus.dispatch({ action: 'importFromDrive' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('imports sessions from Drive, skipping existing ones', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: null };

      vi.mocked(chrome.identity.getAuthToken).mockResolvedValue({ token: 'test-token' } as chrome.identity.GetAuthTokenResult);

      // Existing local session
      const existingSession = createSession({ id: 'existing-id' });
      await db.putSession(existingSession);

      const remoteSession = createSession({ id: 'remote-id', name: 'Remote Session' });

      // Mock listFiles
      mockFetch
        .mockResolvedValueOnce(mockResponse({
          files: [
            { id: 'df1', name: 'tabzen-session-existing-id.json', mimeType: 'application/json' },
            { id: 'df2', name: 'tabzen-session-remote-id.json', mimeType: 'application/json' },
            { id: 'df3', name: 'other-file.txt', mimeType: 'text/plain' }, // should be skipped
          ],
        }))
        // readFile for existing session (will be skipped by ID)
        .mockResolvedValueOnce(mockResponse(JSON.stringify({ ...existingSession })))
        // readFile for remote session
        .mockResolvedValueOnce(mockResponse(JSON.stringify(remoteSession)));

      const result = await bus.dispatch({ action: 'importFromDrive' });
      expect(result.ok).toBe(true);
      expect((result.data as { imported: number }).imported).toBe(1);

      // Remote session should be in DB
      const imported = await db.getSession('remote-id');
      expect(imported).toBeDefined();
      expect(imported?.name).toBe('Remote Session');
      expect(imported?.driveFileId).toBe('df2');
    });
  });

  describe('backupSession', () => {
    it('returns error when sync is not enabled', async () => {
      const session = createSession();
      await db.putSession(session);

      const result = await bus.dispatch({ action: 'backupSession', sessionId: session.id });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('returns error for non-existent session', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: null };

      const result = await bus.dispatch({ action: 'backupSession', sessionId: 'nonexistent' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('creates a new Drive file for a session without driveFileId', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: null };

      vi.mocked(chrome.identity.getAuthToken).mockResolvedValue({ token: 'test-token' } as chrome.identity.GetAuthTokenResult);

      const session = createSession({ id: 'sess-new' });
      await db.putSession(session);

      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'created-id', name: 'test.json', mimeType: 'application/json' }));

      const result = await bus.dispatch({ action: 'backupSession', sessionId: 'sess-new' });
      expect(result.ok).toBe(true);

      const updated = await db.getSession('sess-new');
      expect(updated?.driveFileId).toBe('created-id');
    });

    it('updates existing Drive file for a session with driveFileId', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: null };

      vi.mocked(chrome.identity.getAuthToken).mockResolvedValue({ token: 'test-token' } as chrome.identity.GetAuthTokenResult);

      const session = createSession({ id: 'sess-existing', driveFileId: 'drive-existing' });
      await db.putSession(session);

      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'drive-existing', name: 'test.json', mimeType: 'application/json' }));

      const result = await bus.dispatch({ action: 'backupSession', sessionId: 'sess-existing' });
      expect(result.ok).toBe(true);

      // Should have called PATCH (update), not POST (create)
      const [url, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe('PATCH');
      expect(url).toContain('drive-existing');
    });
  });

  describe('backupSessionIfEnabled', () => {
    it('does nothing when sync is disabled', async () => {
      const session = createSession();
      await backupSessionIfEnabled(db, session);
      // No fetch calls should have been made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uploads session when sync is enabled', async () => {
      const { storageLocalData } = await import('../../../../tests/setup');
      storageLocalData[SYNC_STATE_KEY] = { enabled: true, lastSyncTime: null };

      vi.mocked(chrome.identity.getAuthToken).mockResolvedValue({ token: 'test-token' } as chrome.identity.GetAuthTokenResult);

      const session = createSession({ id: 'auto-backup' });
      await db.putSession(session);

      mockFetch.mockResolvedValueOnce(mockResponse({ id: 'auto-id', name: 'test.json', mimeType: 'application/json' }));

      await backupSessionIfEnabled(db, session);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const updated = await db.getSession('auto-backup');
      expect(updated?.driveFileId).toBe('auto-id');
    });
  });
});
