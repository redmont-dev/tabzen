import type { MessageBus } from '../message-bus';
import type { Session, SyncStatus } from '@/data/types';
import type { TabzenDB } from '@/data/indexed-db';
import { DriveAPI } from '../utils/drive-api';
import { LocalStorage } from '@/data/storage';
import { SYNC_STATE_KEY } from '@/shared/constants';

interface SyncState {
  enabled: boolean;
  lastSyncTime: number | null;
}

const DEFAULT_SYNC_STATE: SyncState = { enabled: false, lastSyncTime: null };

async function getSyncState(): Promise<SyncState> {
  return LocalStorage.get<SyncState>(SYNC_STATE_KEY, DEFAULT_SYNC_STATE);
}

async function setSyncState(state: SyncState): Promise<void> {
  await LocalStorage.set(SYNC_STATE_KEY, state);
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

    await setSyncState({ ...state, lastSyncTime: Date.now() });
  } catch {
    // Backup failure should not break session save
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

export async function registerDriveSync(bus: MessageBus, db: TabzenDB): Promise<void> {
  const api = new DriveAPI(getAuthToken);

  bus.register('enableSync', async () => {
    // Request auth token interactively to trigger consent
    await chrome.identity.getAuthToken({ interactive: true });
    await setSyncState({ enabled: true, lastSyncTime: null });
    return { ok: true };
  });

  bus.register('disableSync', async () => {
    // Revoke cached token
    try {
      const result = await chrome.identity.getAuthToken({ interactive: false });
      if (result.token) {
        await chrome.identity.removeCachedAuthToken({ token: result.token });
      }
    } catch {
      // Token might not exist
    }

    await setSyncState({ enabled: false, lastSyncTime: null });

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
    const state = await getSyncState();
    const sessions = await db.getAllSessions();
    const sessionCount = sessions.filter(s => s.driveFileId !== null).length;
    const status: SyncStatus = {
      enabled: state.enabled,
      lastSyncTime: state.lastSyncTime,
      sessionCount,
    };
    return { ok: true, data: status };
  });

  bus.register('syncSessions', async () => {
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
    await setSyncState({ ...state, lastSyncTime: now });
    return { ok: true, data: { synced, lastSyncTime: now } };
  });

  bus.register('importFromDrive', async () => {
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
    const state = await getSyncState();
    if (!state.enabled) {
      return { ok: false, error: 'Sync is not enabled' };
    }

    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }

    if (session.driveFileId) {
      await api.updateFile(session.driveFileId, JSON.stringify(session));
    } else {
      const driveFile = await api.createFile(sessionFileName(session), JSON.stringify(session));
      await db.putSession({ ...session, driveFileId: driveFile.id });
    }

    const now = Date.now();
    await setSyncState({ ...state, lastSyncTime: now });
    return { ok: true };
  });
}
