import type { MessageBus } from '../message-bus';
import type { Session, SessionTab, SessionGroup, SessionSource } from '@/data/types';
import { TabzenDB } from '@/data/indexed-db';
import { SessionStorage } from '@/data/storage';
import { getSettings } from '@/data/settings';
import {
  NON_RESTORABLE_PROTOCOLS,
  AUTO_SAVE_ALARM_NAME,
  WINDOW_SNAPSHOT_PREFIX,
  MIN_TABS_FOR_CLOSE_SAVE,
  MAX_AUTO_SESSIONS,
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

/**
 * A stable description of what a window contained: which tabs, in order,
 * pinned or not, and under which group name.
 *
 * Group *ids* are deliberately not part of this. Chrome hands out fresh ids
 * every restart, so including them would make two identical windows look
 * different across a restart and defeat the whole comparison.
 */
function fingerprint(tabs: SessionTab[], groups: SessionGroup[]): string {
  const titleById = new Map(groups.map(g => [g.id, g.title]));
  return tabs
    .map(t => {
      const group = t.groupId !== null ? titleById.get(t.groupId) ?? '' : '';
      return `${t.pinned ? 'p' : '-'}|${group}|${t.url}`;
    })
    .join('\n');
}

/** Automatic sessions, newest first. */
function automaticSessions(sessions: Session[]): Session[] {
  return sessions
    .filter(s => s.source === 'auto' || s.source === 'close')
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Keep only the newest MAX_AUTO_SESSIONS automatically-created sessions.
 *
 * Auto-save plus save-on-close adds sessions indefinitely, and nothing else
 * ever removes them. Sessions the user saved by hand are left alone — those
 * were a deliberate act and are not ours to discard.
 */
async function pruneAutoSessions(db: TabzenDB, known?: Session[]): Promise<void> {
  const automatic = automaticSessions(known ?? (await db.getAllSessions()));

  for (const stale of automatic.slice(MAX_AUTO_SESSIONS)) {
    try {
      if (stale.driveFileId) {
        deleteDriveFileIfEnabled(stale.driveFileId).catch(err =>
          console.warn('Drive file deletion failed:', err),
        );
      }
      await db.deleteSession(stale.id);
    } catch (err) {
      console.warn(`Failed to prune session "${stale.id}":`, err);
    }
  }
}

/**
 * Store an automatic snapshot, unless it is identical to the last one.
 *
 * An hourly schedule on an unattended machine writes the same tab set 24 times
 * a day. Skipping the unchanged ones is what keeps the session list meaningful;
 * the count cap is only a backstop behind it.
 *
 * Returns null when the snapshot was skipped.
 */
async function saveAutomaticSession(
  db: TabzenDB,
  snapshot: WindowSnapshot,
  source: SessionSource,
): Promise<Session | null> {
  const existing = await db.getAllSessions();
  const [latest] = automaticSessions(existing);

  if (latest && fingerprint(latest.tabs, latest.groups) === fingerprint(snapshot.tabs, snapshot.groups)) {
    return null;
  }

  const session = await buildSession(snapshot, undefined, source);
  await db.putSession(session);
  await pruneAutoSessions(db, [...existing, session]);
  return session;
}

async function saveSession(
  db: TabzenDB,
  windowId: number,
  name?: string,
  source: SessionSource = 'manual',
): Promise<Session | null> {
  const snapshot = await captureWindowSnapshot(windowId);

  // A manual save is an explicit request — always honour it, unchanged or not.
  if (source !== 'manual') {
    return saveAutomaticSession(db, snapshot, source);
  }

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
        color: sessionGroup.color,
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

// `force` reschedules even if the alarm already exists (the user changed the
// setting). Without it, a plain service-worker restart must NOT re-create the
// alarm: chrome.alarms.create resets the countdown, and MV3 restarts the worker
// constantly, so re-creating every start would push the fire time back forever
// and the scheduled save would never run.
async function configureAutoSave(_db: TabzenDB, force = false): Promise<void> {
  const settings = await getSettings();

  if (settings.autoSaveSchedule === 'disabled') {
    await chrome.alarms.clear(AUTO_SAVE_ALARM_NAME);
    return;
  }

  if (!force && (await chrome.alarms.get(AUTO_SAVE_ALARM_NAME))) {
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

// Cache a snapshot of every currently-open window. Without this, save-on-close
// only works for windows that emit a tab event *after* the feature is enabled —
// so enabling the toggle and immediately closing a window would save nothing.
async function snapshotAllWindows(): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoSaveOnClose) return;
  const windows = await chrome.windows.getAll();
  for (const w of windows) {
    if (w.id === undefined) continue;
    const snapshot = await captureWindowSnapshot(w.id);
    if (snapshot.tabs.length > 0) {
      await SessionStorage.set(snapshotKey(w.id), snapshot);
    }
  }
}

// Reconcile all background auto-save state with the current settings: the
// scheduled alarm and the per-window close snapshots. Runs on every
// service-worker start and whenever auto-save settings change.
async function reconcileAutoSaveState(db: TabzenDB, force = false): Promise<void> {
  await configureAutoSave(db, force);
  await snapshotAllWindows();
}

async function saveClosedWindowSession(db: TabzenDB, windowId: number): Promise<void> {
  const settings = await getSettings();
  const snapshot = await SessionStorage.get<WindowSnapshot | null>(snapshotKey(windowId), null);
  await SessionStorage.remove(snapshotKey(windowId));

  if (!settings.autoSaveOnClose || !snapshot) return;
  if (snapshot.tabs.length < MIN_TABS_FOR_CLOSE_SAVE) return;

  const session = await saveAutomaticSession(db, snapshot, 'close');
  if (!session) return; // Identical to the last automatic snapshot

  backupSessionIfEnabled(db, session).catch(err => console.warn('Drive backup failed:', err));

  if (!settings.autoSaveSkipConfirm) {
    notify('Session saved', `Saved ${snapshot.tabs.length} tabs from the closed window as "${session.name}".`);
  }
}

export function registerSessionManager(
  bus: MessageBus,
  existingDb?: TabzenDB,
  existingReady?: Promise<void>,
): { db: TabzenDB; ready: Promise<void> } {
  const db = existingDb ?? new TabzenDB();
  const ready: Promise<void> = existingReady ?? (existingDb ? Promise.resolve() : db.open());

  // Reconcile the auto-save alarm and close-snapshots from persisted settings
  // on every SW start.
  ready
    .then(() => reconcileAutoSaveState(db))
    .catch(err => console.error('SessionManager init failed:', err));

  bus.register('saveSession', async (req) => {
    await ready;
    const session = await saveSession(db, req.windowId, req.name, req.source);
    if (session) {
      // Best-effort backup to Drive (non-blocking)
      backupSessionIfEnabled(db, session).catch(err => console.warn('Drive backup failed:', err));
    }
    // data is null when an automatic save was skipped as unchanged
    return { ok: true, data: session };
  });

  bus.register('getSessions', async () => {
    await ready;
    const sessions = await db.getAllSessions();
    return { ok: true, data: sessions };
  });

  // Preferred over getSessions for anything that renders a fixed number of
  // rows: sessions are ~4KB each and cross the message boundary by structured
  // clone, so returning the whole store to draw five of them is pure waste.
  bus.register('getRecentSessions', async (req) => {
    await ready;
    const all = await db.getAllSessions();
    const sessions = [...all]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(0, req.limit));
    return { ok: true, data: { sessions, total: all.length } };
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
    // Triggered by a settings change — force a fresh schedule.
    await reconcileAutoSaveState(db, true);
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
        // Nothing changed since the last automatic save — stay quiet
        if (session) {
          backupSessionIfEnabled(db, session).catch(err => console.warn('Drive backup failed:', err));
          const settings = await getSettings();
          if (!settings.autoSaveSkipConfirm) {
            notify('Session saved', `Auto-saved ${session.tabs.length} tabs as "${session.name}".`);
          }
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
