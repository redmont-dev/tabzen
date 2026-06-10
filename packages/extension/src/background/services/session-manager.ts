import type { MessageBus } from '../message-bus';
import type { Session, SessionTab, SessionGroup, Settings, SessionSource } from '@/data/types';
import { TabzenDB } from '@/data/indexed-db';
import { SyncStorage, SessionStorage } from '@/data/storage';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  NON_RESTORABLE_PROTOCOLS,
  AUTO_SAVE_ALARM_NAME,
  WINDOW_SNAPSHOT_PREFIX,
  MIN_TABS_FOR_CLOSE_SAVE,
} from '@/shared/constants';
import { backupSessionIfEnabled, deleteDriveFileIfEnabled } from './drive-sync';
import { notify } from '../utils/notify';

interface WindowSnapshot {
  tabs: SessionTab[];
  groups: SessionGroup[];
}

function generateId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRestorableUrl(url: string): boolean {
  return !NON_RESTORABLE_PROTOCOLS.some(protocol => url.startsWith(protocol));
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `Session ${month}/${day} ${hours}:${minutes}`;
}

async function getSettings(): Promise<Settings> {
  return SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

async function captureWindowSnapshot(windowId: number): Promise<WindowSnapshot> {
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
  ]);

  // Filter non-restorable URLs and tabs without URLs
  const sessionTabs: SessionTab[] = tabs
    .filter(t => t.url && isRestorableUrl(t.url))
    .map(t => ({
      url: t.url!,
      title: t.title ?? '',
      pinned: t.pinned ?? false,
      groupId: (t.groupId !== undefined && t.groupId !== -1) ? t.groupId : null,
    }));

  // Capture groups that have at least one tab in the session
  const activeGroupIds = new Set(sessionTabs.map(t => t.groupId).filter(id => id !== null));
  const sessionGroups: SessionGroup[] = groups
    .filter(g => activeGroupIds.has(g.id))
    .map(g => ({
      id: g.id,
      title: g.title ?? '',
      color: g.color as SessionGroup['color'],
      collapsed: g.collapsed ?? false,
    }));

  return { tabs: sessionTabs, groups: sessionGroups };
}

async function buildSession(
  snapshot: WindowSnapshot,
  name?: string,
  source: SessionSource = 'manual',
): Promise<Session> {
  const settings = await getSettings();
  return {
    id: generateId(),
    name: name || formatTimestamp(Date.now()),
    workspaceId: settings.activeWorkspaceId ?? null,
    createdAt: Date.now(),
    source,
    tabs: snapshot.tabs,
    groups: snapshot.groups,
    driveFileId: null,
  };
}

async function saveSession(
  db: TabzenDB,
  windowId: number,
  name?: string,
  source: SessionSource = 'manual',
): Promise<Session> {
  const snapshot = await captureWindowSnapshot(windowId);
  const session = await buildSession(snapshot, name, source);
  await db.putSession(session);
  return session;
}

async function restoreSession(db: TabzenDB, sessionId: string): Promise<void> {
  const session = await db.getSession(sessionId);
  if (!session) {
    throw new Error(`Session "${sessionId}" not found`);
  }

  if (!session.tabs || session.tabs.length === 0) {
    throw new Error('Session has no tabs');
  }

  // Create a new window with the first tab
  const firstTab = session.tabs[0];
  const newWindow = await chrome.windows.create({
    url: firstTab.url,
    focused: true,
  });

  if (!newWindow?.id) return;
  const windowId = newWindow.id;

  // chrome.windows.create may not populate `tabs` — fall back to querying
  let firstTabId = newWindow.tabs?.[0]?.id;
  if (firstTabId === undefined) {
    const windowTabs = await chrome.tabs.query({ windowId });
    firstTabId = windowTabs[0]?.id;
  }

  // Track created tab IDs per session group so each group is created in one call
  const groupTabIds = new Map<number, number[]>();
  if (firstTab.groupId !== null && firstTabId !== undefined && !firstTab.pinned) {
    groupTabIds.set(firstTab.groupId, [firstTabId]);
  }

  // Create remaining tabs with explicit indexes to preserve order
  for (let i = 1; i < session.tabs.length; i++) {
    const tab = session.tabs[i];
    const created = await chrome.tabs.create({
      windowId,
      url: tab.url,
      pinned: tab.pinned,
      index: i,
      active: false,
    });

    // Pinned tabs cannot belong to groups
    if (tab.groupId !== null && created.id !== undefined && !tab.pinned) {
      const ids = groupTabIds.get(tab.groupId) ?? [];
      ids.push(created.id);
      groupTabIds.set(tab.groupId, ids);
    }
  }

  // Pin the first tab if needed (windows.create cannot create pinned tabs)
  if (firstTab.pinned && firstTabId !== undefined) {
    try {
      await chrome.tabs.update(firstTabId, { pinned: true });
    } catch (err) {
      console.warn('Failed to pin first restored tab:', err);
    }
  }

  // Recreate each group in a single call, then apply its properties
  for (const sessionGroup of session.groups) {
    const tabIds = groupTabIds.get(sessionGroup.id);
    if (!tabIds || tabIds.length === 0) continue;
    try {
      const newGroupId = await chrome.tabs.group({
        tabIds: tabIds as [number, ...number[]],
        createProperties: { windowId },
      });
      await chrome.tabGroups.update(newGroupId, {
        title: sessionGroup.title,
        color: sessionGroup.color as chrome.tabGroups.ColorEnum,
        collapsed: sessionGroup.collapsed,
      });
    } catch (err) {
      console.warn(`Failed to recreate group "${sessionGroup.title}":`, err);
    }
  }
}

async function restoreSessionTabs(
  db: TabzenDB,
  sessionId: string,
  tabIndices: number[],
): Promise<void> {
  const session = await db.getSession(sessionId);
  if (!session) {
    throw new Error(`Session "${sessionId}" not found`);
  }

  for (const idx of tabIndices) {
    if (idx >= 0 && idx < session.tabs.length) {
      const tab = session.tabs[idx];
      await chrome.tabs.create({
        url: tab.url,
        pinned: tab.pinned,
      });
    }
  }
}

async function configureAutoSave(db: TabzenDB): Promise<void> {
  const settings = await getSettings();

  if (settings.autoSaveSchedule === 'disabled') {
    await chrome.alarms.clear(AUTO_SAVE_ALARM_NAME);
    return;
  }

  if (settings.autoSaveSchedule === 'hourly') {
    chrome.alarms.create(AUTO_SAVE_ALARM_NAME, {
      periodInMinutes: 60,
      delayInMinutes: 60,
    });
  } else if (settings.autoSaveSchedule === 'daily') {
    // Calculate delay until the configured daily time
    const [hours, minutes] = settings.autoSaveDailyTime.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const delayMs = target.getTime() - now.getTime();
    const delayMinutes = Math.max(1, Math.round(delayMs / 60000));

    chrome.alarms.create(AUTO_SAVE_ALARM_NAME, {
      delayInMinutes: delayMinutes,
      periodInMinutes: 1440, // 24 hours
    });
  }
}

function snapshotKey(windowId: number): string {
  return `${WINDOW_SNAPSHOT_PREFIX}${windowId}`;
}

// Debounce snapshot updates per window so bursts of tab events coalesce.
// If the service worker dies before a pending flush, the previous snapshot
// remains in storage — save-on-close is best-effort by design.
const SNAPSHOT_DEBOUNCE_MS = 500;
const pendingSnapshotTimers = new Map<number, ReturnType<typeof setTimeout>>();

function scheduleWindowSnapshot(windowId: number): void {
  const existing = pendingSnapshotTimers.get(windowId);
  if (existing) clearTimeout(existing);

  pendingSnapshotTimers.set(windowId, setTimeout(async () => {
    pendingSnapshotTimers.delete(windowId);
    try {
      const settings = await getSettings();
      if (!settings.autoSaveOnClose) return;
      const snapshot = await captureWindowSnapshot(windowId);
      if (snapshot.tabs.length === 0) {
        await SessionStorage.remove(snapshotKey(windowId));
      } else {
        await SessionStorage.set(snapshotKey(windowId), snapshot);
      }
    } catch {
      // Window may already be gone
    }
  }, SNAPSHOT_DEBOUNCE_MS));
}

async function saveClosedWindowSession(db: TabzenDB, windowId: number): Promise<void> {
  const settings = await getSettings();
  const snapshot = await SessionStorage.get<WindowSnapshot | null>(snapshotKey(windowId), null);
  await SessionStorage.remove(snapshotKey(windowId));

  if (!settings.autoSaveOnClose || !snapshot) return;
  if (snapshot.tabs.length < MIN_TABS_FOR_CLOSE_SAVE) return;

  const session = await buildSession(snapshot, undefined, 'close');
  await db.putSession(session);
  backupSessionIfEnabled(db, session).catch(err => console.warn('Drive backup failed:', err));

  if (!settings.autoSaveSkipConfirm) {
    notify('Session saved', `Saved ${snapshot.tabs.length} tabs from the closed window as "${session.name}".`);
  }
}

export function registerSessionManager(bus: MessageBus, existingDb?: TabzenDB): { db: TabzenDB; ready: Promise<void> } {
  const db = existingDb ?? new TabzenDB();
  const ready: Promise<void> = existingDb ? Promise.resolve() : db.open();

  // Schedule the auto-save alarm from persisted settings on every SW start
  ready
    .then(() => configureAutoSave(db))
    .catch(err => console.error('SessionManager init failed:', err));

  bus.register('saveSession', async (req) => {
    await ready;
    const session = await saveSession(db, req.windowId, req.name, req.source);
    // Best-effort backup to Drive (non-blocking)
    backupSessionIfEnabled(db, session).catch(err => console.warn('Drive backup failed:', err));
    return { ok: true, data: session };
  });

  bus.register('getSessions', async () => {
    await ready;
    const sessions = await db.getAllSessions();
    return { ok: true, data: sessions };
  });

  bus.register('getSession', async (req) => {
    await ready;
    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }
    return { ok: true, data: session };
  });

  bus.register('restoreSession', async (req) => {
    await ready;
    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }
    await restoreSession(db, req.sessionId);
    bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'sessionsUsed' }).catch(() => {});
    return { ok: true };
  });

  bus.register('restoreSessionTabs', async (req) => {
    await ready;
    await restoreSessionTabs(db, req.sessionId, req.tabIndices);
    bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'sessionsUsed' }).catch(() => {});
    return { ok: true };
  });

  bus.register('deleteSession', async (req) => {
    await ready;
    const session = await db.getSession(req.sessionId);
    if (session?.driveFileId) {
      deleteDriveFileIfEnabled(session.driveFileId).catch(err => console.warn('Drive file deletion failed:', err));
    }
    await db.deleteSession(req.sessionId);
    return { ok: true };
  });

  bus.register('renameSession', async (req) => {
    await ready;
    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }
    const updated = { ...session, name: req.name };
    await db.putSession(updated);
    return { ok: true, data: updated };
  });

  bus.register('configureAutoSave', async () => {
    await ready;
    await configureAutoSave(db);
    return { ok: true };
  });

  // Listen for alarm events (scheduled auto-save)
  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== AUTO_SAVE_ALARM_NAME) return;
    try {
      await ready;
      const window = await chrome.windows.getLastFocused();
      if (window.id) {
        const session = await saveSession(db, window.id, undefined, 'auto');
        backupSessionIfEnabled(db, session).catch(err => console.warn('Drive backup failed:', err));
        const settings = await getSettings();
        if (!settings.autoSaveSkipConfirm) {
          notify('Session saved', `Auto-saved ${session.tabs.length} tabs as "${session.name}".`);
        }
      }
    } catch (err) {
      console.warn('Scheduled auto-save failed:', err);
    }
  });

  // Save-on-close: keep a per-window snapshot cached in chrome.storage.session
  // (tabs are already gone when windows.onRemoved fires).
  chrome.tabs.onCreated.addListener(tab => {
    if (tab.windowId !== undefined) scheduleWindowSnapshot(tab.windowId);
  });
  chrome.tabs.onRemoved.addListener((_tabId, info) => {
    if (!info.isWindowClosing) scheduleWindowSnapshot(info.windowId);
  });
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.windowId !== undefined) {
      scheduleWindowSnapshot(tab.windowId);
    }
  });
  chrome.tabs.onMoved.addListener((_tabId, info) => {
    scheduleWindowSnapshot(info.windowId);
  });

  chrome.windows.onRemoved.addListener(async (windowId) => {
    try {
      await ready;
      await saveClosedWindowSession(db, windowId);
    } catch (err) {
      console.warn('Save-on-close failed:', err);
    }
  });

  return { db, ready };
}
