import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageBus } from '../../message-bus';
import { registerSearchIndex } from '../search-index';

describe('SearchIndex', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    vi.mocked(chrome.tabs.query).mockReset();
    vi.mocked(chrome.tabGroups.query).mockReset();
  });

  function registerAndDispatch(query: string, scope: 'tabs' | 'sessions' | 'all' = 'tabs') {
    registerSearchIndex(bus);
    return bus.dispatch({ action: 'searchTabs', query, scope });
  }

  it('registers the searchTabs handler', () => {
    registerSearchIndex(bus);
    // Should not throw when dispatching
    expect(() => registerSearchIndex(new MessageBus())).not.toThrow();
  });

  it('returns matching tabs by title', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, title: 'GitHub - Pull Requests', url: 'https://github.com/pulls', windowId: 1, index: 0 },
      { id: 2, title: 'Google Docs', url: 'https://docs.google.com', windowId: 1, index: 1 },
      { id: 3, title: 'GitLab Issues', url: 'https://gitlab.com/issues', windowId: 1, index: 2 },
    ] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

    const result = await registerAndDispatch('github');
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].tabId).toBe(1);
    expect(result.data[0].title).toBe('GitHub - Pull Requests');
  });

  it('returns matching tabs by URL', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, title: 'My Page', url: 'https://example.com/docs', windowId: 1, index: 0 },
      { id: 2, title: 'Other Page', url: 'https://other.com', windowId: 1, index: 1 },
    ] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

    const result = await registerAndDispatch('example.com');
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].tabId).toBe(1);
  });

  it('includes group info in results', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, title: 'React Docs', url: 'https://react.dev', windowId: 1, index: 0, groupId: 10 },
    ] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([
      { id: 10, title: 'Dev', color: 'blue', collapsed: false, windowId: 1 },
    ] as chrome.tabGroups.TabGroup[]);

    const result = await registerAndDispatch('react');
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].groupName).toBe('Dev');
    expect(result.data[0].groupColor).toBe('blue');
  });

  it('returns empty array for no matches', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, title: 'GitHub', url: 'https://github.com', windowId: 1, index: 0 },
    ] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

    const result = await registerAndDispatch('zzzznoMatch');
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it('returns empty array for empty query', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, title: 'GitHub', url: 'https://github.com', windowId: 1, index: 0 },
    ] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

    const result = await registerAndDispatch('');
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it('handles fuzzy matching', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, title: 'Stack Overflow - JavaScript', url: 'https://stackoverflow.com/questions', windowId: 1, index: 0 },
      { id: 2, title: 'MDN Web Docs', url: 'https://developer.mozilla.org', windowId: 1, index: 1 },
    ] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

    // "stackoverflow" fuzzy-matched against title
    const result = await registerAndDispatch('stack overflow');
    expect(result.ok).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0].tabId).toBe(1);
  });

  it('limits results to 20', async () => {
    const tabs = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      title: `Tab ${i + 1} - search term`,
      url: `https://example.com/${i}`,
      windowId: 1,
      index: i,
    }));
    vi.mocked(chrome.tabs.query).mockResolvedValue(tabs as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

    const result = await registerAndDispatch('search term');
    expect(result.ok).toBe(true);
    expect(result.data.length).toBeLessThanOrEqual(20);
  });

  it('includes tab with no group as ungrouped', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, title: 'Loose Tab', url: 'https://loose.com', windowId: 1, index: 0, groupId: -1 },
    ] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

    const result = await registerAndDispatch('loose');
    expect(result.ok).toBe(true);
    expect(result.data[0].groupName).toBeNull();
    expect(result.data[0].groupColor).toBeNull();
  });

  describe('session scope', () => {
    const sessions = [
      {
        id: 's1',
        name: 'Work research',
        workspaceId: null,
        createdAt: 100,
        source: 'manual',
        tabs: [{ url: 'https://github.com/org/repo', title: 'GitHub Repo', pinned: false, groupId: null }],
        groups: [],
        driveFileId: null,
      },
      {
        id: 's2',
        name: 'Vacation planning',
        workspaceId: null,
        createdAt: 200,
        source: 'manual',
        tabs: [{ url: 'https://maps.example.com', title: 'Maps', pinned: false, groupId: null }],
        groups: [],
        driveFileId: null,
      },
    ];

    beforeEach(() => {
      bus.register('getSessions', async () => ({ ok: true, data: sessions }));
    });

    it('matches sessions by name for sessions scope', async () => {
      const result = await registerAndDispatch('vacation', 'sessions');
      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ kind: 'session', sessionId: 's2', tabCount: 1 });
    });

    it('matches sessions by contained tab title', async () => {
      const result = await registerAndDispatch('github repo', 'sessions');
      expect(result.ok).toBe(true);
      expect(result.data[0]).toMatchObject({ kind: 'session', sessionId: 's1' });
    });

    it('returns both tabs and sessions for all scope', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1, title: 'GitHub - Open Tab', url: 'https://github.com', windowId: 1, index: 0, groupId: -1 },
      ] as chrome.tabs.Tab[]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const result = await registerAndDispatch('github', 'all');
      expect(result.ok).toBe(true);
      const kinds = (result.data as Array<{ kind: string }>).map(r => r.kind);
      expect(kinds).toContain('tab');
      expect(kinds).toContain('session');
    });

    it('does not include sessions for tabs scope', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([]);
      vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);

      const result = await registerAndDispatch('vacation', 'tabs');
      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });
});
