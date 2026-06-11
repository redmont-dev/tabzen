import type { MessageBus } from '../message-bus';
import type { AnalyticsSnapshot, AnalyticsTimeRange, DashboardStats, Settings } from '@/data/types';
import { TabzenDB } from '@/data/indexed-db';
import { SyncStorage, LocalStorage } from '@/data/storage';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  MAX_ANALYTICS_DAYS,
  ANALYTICS_SNAPSHOT_INTERVAL,
  ANALYTICS_ALARM_NAME,
  PENDING_ANALYTICS_KEY,
} from '@/shared/constants';
import { extractDomain } from '../utils/rule-matcher';

interface PendingCounters {
  duplicatesBlocked: number;
  sessionsUsed: number;
  tabsOpened: number;
}

const ZERO_COUNTERS: PendingCounters = { duplicatesBlocked: 0, sessionsUsed: 0, tabsOpened: 0 };

// Counters accumulate between snapshots. They are written through to
// chrome.storage.local on every increment so MV3 service-worker termination
// doesn't lose them.
let pending: PendingCounters = { ...ZERO_COUNTERS };

// Merge (not overwrite) persisted counters so increments that land before the
// load completes are preserved.
const countersReady: Promise<void> = LocalStorage.get<PendingCounters>(PENDING_ANALYTICS_KEY, ZERO_COUNTERS)
  .then(stored => {
    pending = {
      duplicatesBlocked: pending.duplicatesBlocked + stored.duplicatesBlocked,
      sessionsUsed: pending.sessionsUsed + stored.sessionsUsed,
      tabsOpened: pending.tabsOpened + stored.tabsOpened,
    };
  })
  .catch(err => console.warn('Failed to load pending analytics counters:', err));

function persistCounters(): void {
  countersReady.then(() =>
    LocalStorage.set(PENDING_ANALYTICS_KEY, { ...pending })
      .catch(err => console.warn('Failed to persist analytics counters:', err)),
  );
}

function resetCounters(): PendingCounters {
  const result = { ...pending };
  pending = { ...ZERO_COUNTERS };
  persistCounters();
  return result;
}

const MAX_PENDING_COUNTER = 100_000;

function incrementCounter(metric: keyof PendingCounters, amount = 1): void {
  if (pending[metric] < MAX_PENDING_COUNTER) {
    pending[metric] += amount;
    persistCounters();
  }
}

async function takeSnapshot(db: TabzenDB): Promise<AnalyticsSnapshot> {
  await countersReady;
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

const VALID_RANGES: ReadonlySet<AnalyticsTimeRange> = new Set(['today', 'week', 'month', '90d']);

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
  await countersReady;
  const now = Date.now();
  const rangeMs = getTimeRangeMs(range);
  const from = now - rangeMs;

  const snapshots = await db.getAnalytics(from, now);

  // Live state counts as one more data point: peak tab count and domain
  // totals include the tabs currently open, and group usage is always live.
  const [liveTabs, liveGroups] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabGroups.query({}),
  ]);

  const groupUsage = liveGroups.map(g => ({
    name: g.title || 'Untitled',
    color: g.color,
    count: liveTabs.filter(t => t.groupId === g.id).length,
  }));

  let peakTabCount = liveTabs.length;
  let totalDuplicatesBlocked = 0;
  let totalSessionsUsed = 0;
  let totalTabsOpened = 0;
  const domainTotals = new Map<string, number>();

  for (const tab of liveTabs) {
    if (!tab.url) continue;
    const domain = extractDomain(tab.url);
    if (domain) {
      domainTotals.set(domain, (domainTotals.get(domain) ?? 0) + 1);
    }
  }

  for (const snap of snapshots) {
    if (snap.tabCount > peakTabCount) peakTabCount = snap.tabCount;
    totalDuplicatesBlocked += snap.duplicatesBlocked;
    totalSessionsUsed += snap.sessionsUsed;
    totalTabsOpened += snap.tabsOpened ?? 0;

    for (const d of snap.topDomains) {
      domainTotals.set(d.domain, (domainTotals.get(d.domain) ?? 0) + d.count);
    }
  }

  const topDomains = Array.from(domainTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  // tabsOpened is the sum of "new tab created" events recorded in the range,
  // plus the still-pending counter that hasn't been snapshotted yet.
  return {
    tabsOpened: totalTabsOpened + pending.tabsOpened,
    peakTabCount,
    duplicatesBlocked: totalDuplicatesBlocked + pending.duplicatesBlocked,
    sessionsUsed: totalSessionsUsed + pending.sessionsUsed,
    topDomains,
    groupUsage,
  };
}

// Exported for testing
export { takeSnapshot, pruneOldData, getDashboardStats, resetCounters };

export function registerAnalyticsCollector(bus: MessageBus, existingDb?: TabzenDB): { db: TabzenDB; ready: Promise<void> } {
  const db = existingDb ?? new TabzenDB();
  const dbReady: Promise<void> = existingDb ? Promise.resolve() : db.open();
  const ready = dbReady.then(() => pruneOldData(db));
  ready.catch(err => console.error('AnalyticsCollector init failed:', err));

  bus.register('getAnalytics', async (req) => {
    await ready;
    const snapshots = await db.getAnalytics(req.from, req.to);
    return { ok: true, data: snapshots };
  });

  bus.register('getDashboardStats', async (req) => {
    if (!VALID_RANGES.has(req.range)) {
      return { ok: false, error: `Invalid time range "${req.range}"` };
    }
    await ready;
    const stats = await getDashboardStats(db, req.range);
    return { ok: true, data: stats };
  });

  bus.register('incrementAnalyticsCounter', async (req) => {
    incrementCounter(req.metric, req.amount ?? 1);
    return { ok: true };
  });

  bus.register('takeAnalyticsSnapshot', async () => {
    await ready;
    const snapshot = await takeSnapshot(db);
    return { ok: true, data: snapshot };
  });

  // Count every newly created tab (persisted write-through, so service-worker
  // termination doesn't lose it).
  chrome.tabs.onCreated.addListener(() => {
    incrementCounter('tabsOpened');
  });

  // Set up the periodic snapshot alarm — but only if it doesn't already exist.
  // chrome.alarms.create resets the countdown, and MV3 restarts the worker
  // constantly; re-creating on every start would keep pushing the snapshot back.
  void chrome.alarms.get(ANALYTICS_ALARM_NAME).then(existing => {
    if (!existing) {
      chrome.alarms.create(ANALYTICS_ALARM_NAME, {
        periodInMinutes: ANALYTICS_SNAPSHOT_INTERVAL,
        delayInMinutes: ANALYTICS_SNAPSHOT_INTERVAL,
      });
    }
  });

  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === ANALYTICS_ALARM_NAME) {
      try {
        await ready;
        await takeSnapshot(db);
      } catch {
        // Snapshot failed, will retry next interval
      }
    }
  });

  return { db, ready };
}
