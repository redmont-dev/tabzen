import type { MessageBus } from '../message-bus';
import type { AnalyticsSnapshot, AnalyticsTimeRange, DashboardStats, Settings } from '@/data/types';
import { TabzenDB } from '@/data/indexed-db';
import { SyncStorage } from '@/data/storage';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  MAX_ANALYTICS_DAYS,
  ANALYTICS_SNAPSHOT_INTERVAL,
  ANALYTICS_ALARM_NAME,
} from '@/shared/constants';
import { extractDomain } from '../utils/rule-matcher';

// In-memory counters that accumulate between snapshots
let pendingDuplicatesBlocked = 0;
let pendingSessionsUsed = 0;
let pendingTabsOpened = 0;

function resetCounters(): { duplicatesBlocked: number; sessionsUsed: number; tabsOpened: number } {
  const result = {
    duplicatesBlocked: pendingDuplicatesBlocked,
    sessionsUsed: pendingSessionsUsed,
    tabsOpened: pendingTabsOpened,
  };
  pendingDuplicatesBlocked = 0;
  pendingSessionsUsed = 0;
  pendingTabsOpened = 0;
  return result;
}

async function takeSnapshot(db: TabzenDB): Promise<AnalyticsSnapshot> {
  const settings = await SyncStorage.get<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

  // Get all tabs across all windows
  const tabs = await chrome.tabs.query({});
  const groups = await chrome.tabGroups.query({});

  // Compute top domains
  const domainCounts = new Map<string, number>();
  for (const tab of tabs) {
    if (!tab.url) continue;
    const domain = extractDomain(tab.url);
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }

  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  // Flush pending counters
  const counters = resetCounters();

  const snapshot: AnalyticsSnapshot = {
    timestamp: Date.now(),
    tabCount: tabs.length,
    groupCount: groups.length,
    workspaceId: settings.activeWorkspaceId,
    topDomains,
    duplicatesBlocked: counters.duplicatesBlocked,
    sessionsUsed: counters.sessionsUsed,
    tabsOpened: counters.tabsOpened,
  };

  await db.putAnalytics(snapshot);
  return snapshot;
}

async function pruneOldData(db: TabzenDB): Promise<void> {
  const cutoff = Date.now() - MAX_ANALYTICS_DAYS * 24 * 60 * 60 * 1000;
  await db.pruneAnalytics(cutoff);
}

function getTimeRangeMs(range: AnalyticsTimeRange): number {
  const now = Date.now();
  switch (range) {
    case 'today': {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      return now - startOfDay.getTime();
    }
    case 'week':
      return 7 * 24 * 60 * 60 * 1000;
    case 'month':
      return 30 * 24 * 60 * 60 * 1000;
    case '90d':
      return 90 * 24 * 60 * 60 * 1000;
  }
}

async function getDashboardStats(
  db: TabzenDB,
  range: AnalyticsTimeRange,
): Promise<DashboardStats> {
  const now = Date.now();
  const rangeMs = getTimeRangeMs(range);
  const from = now - rangeMs;

  const snapshots = await db.getAnalytics(from, now);

  if (snapshots.length === 0) {
    return {
      tabsOpened: pendingTabsOpened,
      peakTabCount: 0,
      duplicatesBlocked: pendingDuplicatesBlocked,
      sessionsUsed: pendingSessionsUsed,
      topDomains: [],
      groupUsage: [],
    };
  }

  // Aggregate stats
  let peakTabCount = 0;
  let totalDuplicatesBlocked = 0;
  let totalSessionsUsed = 0;
  let totalTabsOpened = 0;
  const domainTotals = new Map<string, number>();

  for (const snap of snapshots) {
    if (snap.tabCount > peakTabCount) peakTabCount = snap.tabCount;
    totalDuplicatesBlocked += snap.duplicatesBlocked;
    totalSessionsUsed += snap.sessionsUsed;
    totalTabsOpened += snap.tabsOpened ?? 0;

    for (const d of snap.topDomains) {
      domainTotals.set(d.domain, (domainTotals.get(d.domain) ?? 0) + d.count);
    }
  }

  // tabsOpened is the sum of "new tab created" events recorded in the range,
  // plus the still-pending in-memory counter that hasn't been snapshotted yet.
  const tabsOpened = totalTabsOpened + pendingTabsOpened;

  const topDomains = Array.from(domainTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return {
    tabsOpened,
    peakTabCount,
    duplicatesBlocked: totalDuplicatesBlocked + pendingDuplicatesBlocked,
    sessionsUsed: totalSessionsUsed + pendingSessionsUsed,
    topDomains,
    groupUsage: [], // Group usage computed from live data, not snapshots
  };
}

const MAX_PENDING_COUNTER = 100_000;

function incrementCounter(metric: 'duplicatesBlocked' | 'sessionsUsed' | 'tabsOpened', amount = 1): void {
  switch (metric) {
    case 'duplicatesBlocked':
      if (pendingDuplicatesBlocked < MAX_PENDING_COUNTER) pendingDuplicatesBlocked += amount;
      break;
    case 'sessionsUsed':
      if (pendingSessionsUsed < MAX_PENDING_COUNTER) pendingSessionsUsed += amount;
      break;
    case 'tabsOpened':
      if (pendingTabsOpened < MAX_PENDING_COUNTER) pendingTabsOpened += amount;
      break;
  }
}

// Exported for testing
export { takeSnapshot, pruneOldData, getDashboardStats, resetCounters };

export async function registerAnalyticsCollector(bus: MessageBus, existingDb?: TabzenDB): Promise<void> {
  const db = existingDb ?? new TabzenDB();
  if (!existingDb) await db.open();

  // Prune old data on startup
  await pruneOldData(db);

  bus.register('getAnalytics', async (req) => {
    const snapshots = await db.getAnalytics(req.from, req.to);
    return { ok: true, data: snapshots };
  });

  bus.register('getDashboardStats', async (req) => {
    const stats = await getDashboardStats(db, req.range);
    return { ok: true, data: stats };
  });

  bus.register('incrementAnalyticsCounter', async (req) => {
    incrementCounter(req.metric, req.amount ?? 1);
    return { ok: true };
  });

  bus.register('takeAnalyticsSnapshot', async () => {
    const snapshot = await takeSnapshot(db);
    return { ok: true, data: snapshot };
  });

  // Count every newly created tab (cheap; lives entirely in memory until the
  // next snapshot flushes it to IndexedDB).
  chrome.tabs.onCreated.addListener(() => {
    incrementCounter('tabsOpened');
  });

  // Set up periodic snapshot alarm
  chrome.alarms.create(ANALYTICS_ALARM_NAME, {
    periodInMinutes: ANALYTICS_SNAPSHOT_INTERVAL,
    delayInMinutes: ANALYTICS_SNAPSHOT_INTERVAL,
  });

  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === ANALYTICS_ALARM_NAME) {
      try {
        await takeSnapshot(db);
      } catch {
        // Snapshot failed, will retry next interval
      }
    }
  });
}
