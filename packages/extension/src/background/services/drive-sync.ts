import type { MessageBus } from '../message-bus';
import type { Session, SyncStatus } from '@/data/types';
import type { TabzenDB } from '@/data/indexed-db';
import { DriveAPI } from '../utils/drive-api';
import { LocalStorage } from '@/data/storage';
import { SYNC_STATE_KEY } from '@/shared/constants';

interface SyncState {
  enabled: boolean;
  lastSyncTime: number | null;
  lastError: string | null;
  lastErrorTime: number | null;
}

const DEFAULT_SYNC_STATE: SyncState = {
  enabled: false,
  lastSyncTime: null,
  lastError: null,
  lastErrorTime: null,
};

async function getSyncState(): Promise<SyncState> {
  const stored = await LocalStorage.get<Partial<SyncState>>(SYNC_STATE_KEY, DEFAULT_SYNC_STATE);
  return { ...DEFAULT_SYNC_STATE, ...stored };
}

async function setSyncState(state: SyncState): Promise<void> {
  await LocalStorage.set(SYNC_STATE_KEY, state);
}

async function recordSyncError(err: unknown): Promise<void> {
  const state = await getSyncState();
  await setSyncState({
    ...state,
    lastError: err instanceof Error ? err.message : String(err),
    lastErrorTime: Date.now(),
  });
}

async function recordSyncSuccess(): Promise<void> {
  const state = await getSyncState();
  await setSyncState({ ...state, lastSyncTime: Date.now(), lastError: null, lastErrorTime: null });
}

async function getAuthToken(): Promise<string> {
  const result = await chrome.identity.getAuthToken({ interactive: true });
  if (!result.token) throw new Error('Auth token not available');
  return result.token;
}

const MAX_SESSION_TABS = 10_000;
const MAX_SESSION_GROUPS = 1_000;
const VALID_SOURCES = new Set(['manual', 'auto', 'close']);

function validateSession(data: unknown): data is Session {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.id !== 'string' || typeof obj.createdAt !== 'number') return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.source === 'string' && !VALID_SOURCES.has(obj.source)) return false;
  if (!Array.isArray(obj.tabs) || !Array.isArray(obj.groups)) return false;
  if (obj.tabs.length > MAX_SESSION_TABS || obj.groups.length > MAX_SESSION_GROUPS) return false;

  // Validate tab shapes
  for (const tab of obj.tabs) {
    if (!tab || typeof tab !== 'object') return false;
    if (typeof tab.url !== 'string' || typeof tab.title !== 'string') return false;
  }

  // Validate group shapes
  for (const group of obj.groups) {
    if (!group || typeof group !== 'object') return false;
    if (typeof group.title !== 'string' || typeof group.color !== 'string') return false;
  }

  return true;
}

function sessionFileName(session: Session): string {
  return `tabzen-session-${session.id}.json`;
}

export async function backupSessionIfEnabled(
  db: TabzenDB,
  session: Session,
): Promise<void> {
  const state = await getSyncState();
  if (!state.enabled) return;

  const api = new DriveAPI(getAuthToken);

  try {
    if (session.driveFileId) {
      await api.updateFile(session.driveFileId, JSON.stringify(session));
    } else {
      const driveFile = await api.createFile(sessionFileName(session), JSON.stringify(session));
      const updated = { ...session, driveFileId: driveFile.id };
      await db.putSession(updated);
    }

    await recordSyncSuccess();
  } catch (err) {
    // Backup failure should not break session save, but surface it in sync status
    await recordSyncError(err);
  }
}

export async function deleteDriveFileIfEnabled(driveFileId: string | null): Promise<void> {
  if (!driveFileId) return;
  const state = await getSyncState();
  if (!state.enabled) return;

  const api = new DriveAPI(getAuthToken);
  try {
    await api.deleteFile(driveFileId);
  } catch {
    // Best-effort deletion
  }
}

export function registerDriveSync(
  bus: MessageBus,
  db: TabzenDB,
  ready: Promise<void> = Promise.resolve(),
): void {
  const api = new DriveAPI(getAuthToken);

  bus.register('enableSync', async () => {
    // Request auth token interactively to trigger consent
    let result: chrome.identity.GetAuthTokenResult;
    try {
      result = await chrome.identity.getAuthToken({ interactive: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Google sign-in failed: ${message}` };
    }
    if (!result.token) {
      return { ok: false, error: 'Google sign-in failed: no token granted. Make sure you are signed in to Chrome.' };
    }
    await setSyncState({ ...DEFAULT_SYNC_STATE, enabled: true });
    return { ok: true };
  });

  bus.register('disableSync', async () => {
    await ready;
    // Revoke cached token
    try {
      const result = await chrome.identity.getAuthToken({ interactive: false });
      if (result.token) {
        await chrome.identity.removeCachedAuthToken({ token: result.token });
      }
    } catch {
      // Token might not exist
    }

    await setSyncState({ ...DEFAULT_SYNC_STATE });

    // Clear driveFileId from all local sessions
    const sessions = await db.getAllSessions();
    for (const session of sessions) {
      if (session.driveFileId) {
        await db.putSession({ ...session, driveFileId: null });
      }
    }

    return { ok: true };
  });

  bus.register('getSyncStatus', async () => {
    await ready;
    const state = await getSyncState();
    const sessions = await db.getAllSessions();
    const sessionCount = sessions.filter(s => s.driveFileId !== null).length;
    const status: SyncStatus = {
      enabled: state.enabled,
      lastSyncTime: state.lastSyncTime,
      sessionCount,
      lastError: state.lastError,
      lastErrorTime: state.lastErrorTime,
    };
    return { ok: true, data: status };
  });

  bus.register('syncSessions', async () => {
    await ready;
    const state = await getSyncState();
    if (!state.enabled) {
      return { ok: false, error: 'Sync is not enabled' };
    }

    const sessions = await db.getAllSessions();
    let synced = 0;

    const errors: string[] = [];
    for (const session of sessions) {
      try {
        if (session.driveFileId) {
          // Update existing file
          await api.updateFile(session.driveFileId, JSON.stringify(session));
        } else {
          // Create new file
          const driveFile = await api.createFile(sessionFileName(session), JSON.stringify(session));
          await db.putSession({ ...session, driveFileId: driveFile.id });
        }
        synced++;
      } catch (err) {
        errors.push(`Session "${session.id}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const now = Date.now();
    if (errors.length > 0) {
      await setSyncState({
        ...state,
        lastSyncTime: now,
        lastError: errors[0],
        lastErrorTime: now,
      });
    } else {
      await setSyncState({ ...state, lastSyncTime: now, lastError: null, lastErrorTime: null });
    }
    return { ok: true, data: { synced, failed: errors.length, lastSyncTime: now } };
  });

  bus.register('importFromDrive', async () => {
    await ready;
    const state = await getSyncState();
    if (!state.enabled) {
      return { ok: false, error: 'Sync is not enabled' };
    }

    const driveFiles = await api.listFiles();
    const existingSessions = await db.getAllSessions();
    const existingIds = new Set(existingSessions.map(s => s.id));

    let imported = 0;
    for (const file of driveFiles) {
      if (!file.name.startsWith('tabzen-session-')) continue;

      const content = await api.readFile(file.id);
      try {
        const session: Session = JSON.parse(content);
        if (!validateSession(session)) continue;
        if (existingIds.has(session.id)) continue;

        session.driveFileId = file.id;
        await db.putSession(session);
        imported++;
      } catch {
        // Skip malformed files
      }
    }

    return { ok: true, data: { imported } };
  });

  bus.register('backupSession', async (req) => {
    await ready;
    const state = await getSyncState();
    if (!state.enabled) {
      return { ok: false, error: 'Sync is not enabled' };
    }

    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }

    try {
      if (session.driveFileId) {
        await api.updateFile(session.driveFileId, JSON.stringify(session));
      } else {
        const driveFile = await api.createFile(sessionFileName(session), JSON.stringify(session));
        await db.putSession({ ...session, driveFileId: driveFile.id });
      }
    } catch (err) {
      await recordSyncError(err);
      throw err;
    }

    await recordSyncSuccess();
    return { ok: true };
  });
}
