import type { MessageBus } from '../message-bus';
import type { Session, SessionTab, SessionGroup, Settings, SessionSource } from '@/data/types';
import { TabzenDB } from '@/data/indexed-db';
import { SyncStorage } from '@/data/storage';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  NON_RESTORABLE_PROTOCOLS,
  AUTO_SAVE_ALARM_NAME,
} from '@/shared/constants';

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

async function saveSession(
  db: TabzenDB,
  windowId: number,
  name?: string,
  source: SessionSource = 'manual',
): Promise<Session> {
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

  const settings = await getSettings();

  const session: Session = {
    id: generateId(),
    name: name || formatTimestamp(Date.now()),
    workspaceId: settings.activeWorkspaceId ?? null,
    createdAt: Date.now(),
    source,
    tabs: sessionTabs,
    groups: sessionGroups,
    driveFileId: null,
  };

  await db.putSession(session);
  return session;
}

async function restoreSession(db: TabzenDB, sessionId: string): Promise<void> {
  const session = await db.getSession(sessionId);
  if (!session) {
    throw new Error(`Session "${sessionId}" not found`);
  }

  // Create a new window with the first tab
  const firstTab = session.tabs[0];
  const newWindow = await chrome.windows.create({
    url: firstTab?.url,
    focused: true,
  });

  if (!newWindow.id) return;

  // Build group ID mapping: old session groupId -> new Chrome groupId
  const groupIdMap = new Map<number, number>();

  // Create remaining tabs (first was created with the window)
  for (let i = 1; i < session.tabs.length; i++) {
    const tab = session.tabs[i];
    const created = await chrome.tabs.create({
      windowId: newWindow.id,
      url: tab.url,
      pinned: tab.pinned,
    });

    // Group the tab if it belonged to a group
    if (tab.groupId !== null && created.id) {
      const sessionGroup = session.groups.find(g => g.id === tab.groupId);
      if (sessionGroup) {
        if (groupIdMap.has(tab.groupId)) {
          // Add to existing group
          await chrome.tabs.group({
            tabIds: [created.id],
            groupId: groupIdMap.get(tab.groupId)!,
          });
        } else {
          // Create new group
          const newGroupId = await chrome.tabs.group({
            tabIds: [created.id],
            createProperties: { windowId: newWindow.id },
          });
          await chrome.tabGroups.update(newGroupId, {
            title: sessionGroup.title,
            color: sessionGroup.color as chrome.tabGroups.ColorEnum,
            collapsed: sessionGroup.collapsed,
          });
          groupIdMap.set(tab.groupId, newGroupId);
        }
      }
    }
  }

  // Handle first tab's group membership
  if (firstTab?.groupId !== null && firstTab?.groupId !== undefined) {
    const firstTabInWindow = newWindow.tabs?.[0];
    if (firstTabInWindow?.id) {
      const sessionGroup = session.groups.find(g => g.id === firstTab.groupId);
      if (sessionGroup) {
        if (groupIdMap.has(firstTab.groupId)) {
          await chrome.tabs.group({
            tabIds: [firstTabInWindow.id],
            groupId: groupIdMap.get(firstTab.groupId)!,
          });
        } else {
          const newGroupId = await chrome.tabs.group({
            tabIds: [firstTabInWindow.id],
            createProperties: { windowId: newWindow.id },
          });
          await chrome.tabGroups.update(newGroupId, {
            title: sessionGroup.title,
            color: sessionGroup.color as chrome.tabGroups.ColorEnum,
            collapsed: sessionGroup.collapsed,
          });
          groupIdMap.set(firstTab.groupId, newGroupId);
        }
      }
    }
  }

  // Handle first tab pinned status
  if (firstTab?.pinned && newWindow.tabs?.[0]?.id) {
    await chrome.tabs.update(newWindow.tabs[0].id, { pinned: true });
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

export async function registerSessionManager(bus: MessageBus): Promise<void> {
  const db = new TabzenDB(`tabzen-sessions-${Math.random().toString(36).slice(2, 8)}`);
  await db.open();

  bus.register('saveSession', async (req) => {
    const session = await saveSession(db, req.windowId, req.name, req.source);
    return { ok: true, data: session };
  });

  bus.register('getSessions', async () => {
    const sessions = await db.getAllSessions();
    return { ok: true, data: sessions };
  });

  bus.register('getSession', async (req) => {
    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }
    return { ok: true, data: session };
  });

  bus.register('restoreSession', async (req) => {
    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }
    await restoreSession(db, req.sessionId);
    return { ok: true };
  });

  bus.register('restoreSessionTabs', async (req) => {
    await restoreSessionTabs(db, req.sessionId, req.tabIndices);
    return { ok: true };
  });

  bus.register('deleteSession', async (req) => {
    await db.deleteSession(req.sessionId);
    return { ok: true };
  });

  bus.register('renameSession', async (req) => {
    const session = await db.getSession(req.sessionId);
    if (!session) {
      return { ok: false, error: `Session "${req.sessionId}" not found` };
    }
    const updated = { ...session, name: req.name };
    await db.putSession(updated);
    return { ok: true, data: updated };
  });

  bus.register('configureAutoSave', async () => {
    await configureAutoSave(db);
    return { ok: true };
  });

  // Listen for alarm events (auto-save)
  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === AUTO_SAVE_ALARM_NAME) {
      try {
        const window = await chrome.windows.getCurrent();
        if (window.id) {
          await saveSession(db, window.id, undefined, 'auto');
        }
      } catch {
        // Window might not be available
      }
    }
  });

  // Listen for window close events (save-on-close)
  chrome.windows.onRemoved.addListener(async (windowId: number) => {
    try {
      const settings = await getSettings();
      if (settings.autoSaveOnClose) {
        // We can't query tabs of a removed window, so this is a best-effort
        // The window and its tabs are already gone at this point.
        // In practice, we'd need to maintain a cache of window state.
        // For now, this is a placeholder for the close event listener.
      }
    } catch {
      // Ignore errors during window close
    }
  });
}
