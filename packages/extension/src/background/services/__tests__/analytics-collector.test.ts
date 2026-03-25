import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { MessageBus } from '../../message-bus';
import {
  registerAnalyticsCollector,
  resetCounters,
} from '../analytics-collector';
import type { AnalyticsSnapshot, DashboardStats } from '@/data/types';

describe('AnalyticsCollector', () => {
  let bus: MessageBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetCounters();

    bus = new MessageBus();
    await registerAnalyticsCollector(bus);

    // Reset storage
    const { storageSyncData, storageLocalData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageSyncData)) delete storageSyncData[k];
    for (const k of Object.keys(storageLocalData)) delete storageLocalData[k];
  });

  describe('takeAnalyticsSnapshot', () => {
    it('captures current tab and group counts', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'https://example.com', windowId: 1 },
        { id: 2, title: 'Tab 2', url: 'https://github.com/repo', windowId: 1 },
        { id: 3, title: 'Tab 3', url: 'https://github.com/other', windowId: 1 },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([
        { id: 10, title: 'Dev', color: 'blue', collapsed: false, windowId: 1 },
      ] as chrome.tabGroups.TabGroup[]);

      const result = await bus.dispatch({ action: 'takeAnalyticsSnapshot' });
      expect(result.ok).toBe(true);

      const snapshot = result.data as AnalyticsSnapshot;
      expect(snapshot.tabCount).toBe(3);
      expect(snapshot.groupCount).toBe(1);
      expect(snapshot.topDomains).toContainEqual({ domain: 'github.com', count: 2 });
      expect(snapshot.topDomains).toContainEqual({ domain: 'example.com', count: 1 });
    });

    it('flushes pending counters into snapshot', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      await bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'duplicatesBlocked', amount: 5 });
      await bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'sessionsUsed', amount: 2 });

      const result = await bus.dispatch({ action: 'takeAnalyticsSnapshot' });
      const snapshot = result.data as AnalyticsSnapshot;

      expect(snapshot.duplicatesBlocked).toBe(5);
      expect(snapshot.sessionsUsed).toBe(2);

      // Counters should be reset after snapshot
      const result2 = await bus.dispatch({ action: 'takeAnalyticsSnapshot' });
      const snapshot2 = result2.data as AnalyticsSnapshot;
      expect(snapshot2.duplicatesBlocked).toBe(0);
      expect(snapshot2.sessionsUsed).toBe(0);
    });

    it('limits top domains to 10', async () => {
      const tabs = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        title: `Tab ${i}`,
        url: `https://domain${i}.com/page`,
        windowId: 1,
      }));
      vi.mocked(chrome.tabs.query).mockResolvedValue(tabs as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const result = await bus.dispatch({ action: 'takeAnalyticsSnapshot' });
      const snapshot = result.data as AnalyticsSnapshot;
      expect(snapshot.topDomains.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getAnalytics', () => {
    it('returns snapshots within time range', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://example.com', windowId: 1 },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      // Take two snapshots with slight time difference
      await bus.dispatch({ action: 'takeAnalyticsSnapshot' });
      // Small wait to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
      await bus.dispatch({ action: 'takeAnalyticsSnapshot' });

      const now = Date.now();
      const result = await bus.dispatch({
        action: 'getAnalytics',
        from: now - 60000,
        to: now + 60000,
      });

      expect(result.ok).toBe(true);
      const snapshots = result.data as AnalyticsSnapshot[];
      expect(snapshots.length).toBe(2);
    });
  });

  describe('getDashboardStats', () => {
    it('aggregates stats for the given time range', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://example.com', windowId: 1 },
        { id: 2, url: 'https://example.com/other', windowId: 1 },
        { id: 3, url: 'https://github.com', windowId: 1 },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      await bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'duplicatesBlocked', amount: 3 });
      await bus.dispatch({ action: 'takeAnalyticsSnapshot' });

      await bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'sessionsUsed', amount: 1 });
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, url: 'https://example.com', windowId: 1 },
        { id: 2, url: 'https://example.com/other', windowId: 1 },
        { id: 3, url: 'https://github.com', windowId: 1 },
        { id: 4, url: 'https://google.com', windowId: 1 },
        { id: 5, url: 'https://google.com/maps', windowId: 1 },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
      await new Promise(resolve => setTimeout(resolve, 5));
      await bus.dispatch({ action: 'takeAnalyticsSnapshot' });

      const result = await bus.dispatch({ action: 'getDashboardStats', range: 'today' });
      expect(result.ok).toBe(true);

      const stats = result.data as DashboardStats;
      expect(stats.peakTabCount).toBe(5);
      expect(stats.duplicatesBlocked).toBe(3);
      expect(stats.sessionsUsed).toBe(1);
      expect(stats.topDomains.length).toBeGreaterThan(0);
    });

    it('returns empty stats when no data exists', async () => {
      const result = await bus.dispatch({ action: 'getDashboardStats', range: 'week' });
      expect(result.ok).toBe(true);

      const stats = result.data as DashboardStats;
      expect(stats.tabsOpened).toBe(0);
      expect(stats.peakTabCount).toBe(0);
      expect(stats.duplicatesBlocked).toBe(0);
      expect(stats.topDomains).toEqual([]);
    });
  });

  describe('incrementAnalyticsCounter', () => {
    it('increments duplicatesBlocked counter via message', async () => {
      const result = await bus.dispatch({
        action: 'incrementAnalyticsCounter',
        metric: 'duplicatesBlocked',
        amount: 3,
      });
      expect(result.ok).toBe(true);

      vi.mocked(chrome.tabs.query).mockResolvedValue([]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const snapResult = await bus.dispatch({ action: 'takeAnalyticsSnapshot' });
      const snapshot = snapResult.data as AnalyticsSnapshot;
      expect(snapshot.duplicatesBlocked).toBe(3);
    });

    it('defaults amount to 1', async () => {
      await bus.dispatch({ action: 'incrementAnalyticsCounter', metric: 'sessionsUsed' });

      vi.mocked(chrome.tabs.query).mockResolvedValue([]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const snapResult = await bus.dispatch({ action: 'takeAnalyticsSnapshot' });
      const snapshot = snapResult.data as AnalyticsSnapshot;
      expect(snapshot.sessionsUsed).toBe(1);
    });
  });

  describe('alarm setup', () => {
    it('creates a periodic alarm for snapshots on registration', async () => {
      // registerAnalyticsCollector was called in beforeEach
      // Check that alarms.create was called (it happens during registration)
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        'tabzen-analytics-snapshot',
        expect.objectContaining({
          periodInMinutes: 30,
          delayInMinutes: 30,
        }),
      );
    });
  });
});
