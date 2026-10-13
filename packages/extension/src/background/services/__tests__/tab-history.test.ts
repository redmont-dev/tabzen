import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../../message-bus';
import {
  registerTabHistory,
  recordActivation,
  forgetTab,
  forgetWindow,
  seedActiveTabs,
  switchToPreviousTab,
} from '../tab-history';
import { TAB_HISTORY_KEY, MAX_TAB_HISTORY } from '@/shared/constants';

type TabHistory = Record<number, number[]>;

async function history(): Promise<TabHistory> {
  const { storageSessionData } = await import('../../../../tests/setup');
  return (storageSessionData[TAB_HISTORY_KEY] as TabHistory) ?? {};
}

async function setHistory(value: TabHistory): Promise<void> {
  const { storageSessionData } = await import('../../../../tests/setup');
  storageSessionData[TAB_HISTORY_KEY] = value;
}

/** Tabs that exist, keyed by id, so chrome.tabs.get can 404 the rest. */
function mockTabs(tabs: { id: number; windowId: number }[], activeId?: number): void {
  const byId = new Map(tabs.map(t => [t.id, t]));
  vi.mocked(chrome.tabs.get).mockImplementation(async (tabId: number) => {
    const tab = byId.get(tabId);
    if (!tab) throw new Error(`No tab with id: ${tabId}`);
    return tab as chrome.tabs.Tab;
  });
  vi.mocked(chrome.tabs.query).mockImplementation(async (info: chrome.tabs.QueryInfo) => {
    let result = tabs;
    if (info.windowId !== undefined) result = result.filter(t => t.windowId === info.windowId);
    if (info.active) result = result.filter(t => t.id === activeId);
    return result as chrome.tabs.Tab[];
  });
}

describe('TabHistory', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { storageSessionData } = await import('../../../../tests/setup');
    for (const k of Object.keys(storageSessionData)) delete storageSessionData[k];
    vi.mocked(chrome.tabs.query).mockImplementation(async () => []);
  });

  describe('recordActivation', () => {
    it('puts the newest tab at the front of its window', async () => {
      await recordActivation(1, 10);
      await recordActivation(1, 11);
      expect((await history())[1]).toEqual([11, 10]);
    });

    it('moves a re-activated tab to the front instead of duplicating it', async () => {
      await recordActivation(1, 10);
      await recordActivation(1, 11);
      await recordActivation(1, 10);
      expect((await history())[1]).toEqual([10, 11]);
    });

    it('keeps windows independent', async () => {
      await recordActivation(1, 10);
      await recordActivation(2, 20);
      expect(await history()).toEqual({ 1: [10], 2: [20] });
    });

    it('caps the list so history cannot grow without bound', async () => {
      for (let i = 0; i < MAX_TAB_HISTORY + 5; i++) {
        await recordActivation(1, i);
      }
      const list = (await history())[1];
      expect(list).toHaveLength(MAX_TAB_HISTORY);
      // Newest first, oldest dropped
      expect(list[0]).toBe(MAX_TAB_HISTORY + 4);
    });

    it('does not lose entries when activations arrive faster than storage', async () => {
      // Deliberately not awaited individually — writes must serialize
      await Promise.all([
        recordActivation(1, 10),
        recordActivation(1, 11),
        recordActivation(1, 12),
      ]);
      expect((await history())[1]).toHaveLength(3);
    });
  });

  describe('switchToPreviousTab', () => {
    it('activates the second-most-recent tab in the window', async () => {
      await setHistory({ 1: [11, 10] });
      mockTabs([{ id: 10, windowId: 1 }, { id: 11, windowId: 1 }], 11);

      const switched = await switchToPreviousTab(1);

      expect(switched).toBe(true);
      expect(chrome.tabs.update).toHaveBeenCalledWith(10, { active: true });
    });

    it('toggles back and forth between the last two tabs', async () => {
      await setHistory({ 1: [11, 10] });
      mockTabs([{ id: 10, windowId: 1 }, { id: 11, windowId: 1 }], 11);

      await switchToPreviousTab(1);
      // Chrome fires onActivated for the tab we just activated
      await recordActivation(1, 10);
      mockTabs([{ id: 10, windowId: 1 }, { id: 11, windowId: 1 }], 10);

      await switchToPreviousTab(1);

      expect(chrome.tabs.update).toHaveBeenLastCalledWith(11, { active: true });
    });

    it('skips tabs that have been closed and prunes them', async () => {
      await setHistory({ 1: [11, 99, 10] });
      mockTabs([{ id: 10, windowId: 1 }, { id: 11, windowId: 1 }], 11); // 99 is gone

      const switched = await switchToPreviousTab(1);

      expect(switched).toBe(true);
      expect(chrome.tabs.update).toHaveBeenCalledWith(10, { active: true });
      expect((await history())[1]).not.toContain(99);
    });

    it('skips a tab that was dragged into another window', async () => {
      await setHistory({ 1: [11, 12, 10] });
      mockTabs(
        [{ id: 10, windowId: 1 }, { id: 11, windowId: 1 }, { id: 12, windowId: 2 }],
        11,
      );

      const switched = await switchToPreviousTab(1);

      expect(switched).toBe(true);
      expect(chrome.tabs.update).toHaveBeenCalledWith(10, { active: true });
      expect((await history())[1]).not.toContain(12);
    });

    it('returns false when the window has no history', async () => {
      mockTabs([{ id: 10, windowId: 1 }], 10);
      expect(await switchToPreviousTab(1)).toBe(false);
      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    it('returns false when the only remembered tab is the active one', async () => {
      await setHistory({ 1: [10] });
      mockTabs([{ id: 10, windowId: 1 }], 10);

      expect(await switchToPreviousTab(1)).toBe(false);
      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    it('returns false when every remembered tab has been closed', async () => {
      await setHistory({ 1: [10, 98, 99] });
      mockTabs([{ id: 10, windowId: 1 }], 10);

      expect(await switchToPreviousTab(1)).toBe(false);
      expect((await history())[1]).toEqual([10]);
    });

    it('ignores another window’s history', async () => {
      await setHistory({ 2: [21, 20] });
      mockTabs([{ id: 20, windowId: 2 }, { id: 21, windowId: 2 }], 21);

      expect(await switchToPreviousTab(1)).toBe(false);
    });
  });

  describe('forgetTab / forgetWindow', () => {
    it('drops a closed tab from every window', async () => {
      await setHistory({ 1: [10, 11], 2: [11, 20] });
      await forgetTab(11);
      expect(await history()).toEqual({ 1: [10], 2: [20] });
    });

    it('drops a closed window entirely', async () => {
      await setHistory({ 1: [10, 11], 2: [20] });
      await forgetWindow(1);
      expect(await history()).toEqual({ 2: [20] });
    });
  });

  describe('seedActiveTabs', () => {
    it('seeds each window with its active tab so the first switch works', async () => {
      mockTabs([{ id: 10, windowId: 1 }, { id: 20, windowId: 2 }], undefined);
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 10, windowId: 1 },
        { id: 20, windowId: 2 },
      ] as chrome.tabs.Tab[]));

      await seedActiveTabs();

      expect(await history()).toEqual({ 1: [10], 2: [20] });
    });

    it('leaves existing history untouched on a service-worker restart', async () => {
      await setHistory({ 1: [11, 10] });
      vi.mocked(chrome.tabs.query).mockImplementation(async () => ([
        { id: 11, windowId: 1 },
      ] as chrome.tabs.Tab[]));

      await seedActiveTabs();

      expect((await history())[1]).toEqual([11, 10]);
    });
  });

  describe('switchToPreviousTab message handler', () => {
    it('reports whether a switch happened', async () => {
      const bus = new MessageBus();
      registerTabHistory(bus);
      await setHistory({ 1: [11, 10] });
      mockTabs([{ id: 10, windowId: 1 }, { id: 11, windowId: 1 }], 11);

      const result = await bus.dispatch({ action: 'switchToPreviousTab', windowId: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ switched: true });
    });
  });
});
