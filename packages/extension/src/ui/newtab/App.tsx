import { useState, useEffect, useCallback } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import { SearchBar } from '../components/SearchBar';
import { SearchResults, type SearchResultItem } from '../components/SearchResults';
import { WorkspaceCards, type WorkspaceCardData } from './WorkspaceCards';
import { SessionList } from './SessionList';
import { DashboardStats } from './DashboardStats';
import type { Session, Settings, Workspace, DashboardStats as DashboardStatsType } from '@/data/types';
import styles from './App.module.css';

export function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workspaces, setWorkspaces] = useState<WorkspaceCardData[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<DashboardStatsType | null>(null);
  const [disabled, setDisabled] = useState(false);

  const showResults = query.length > 0 && results.length > 0;

  // Load data on mount
  useEffect(() => {
    (async () => {
      // Check if new tab page is enabled
      const settingsRes = await sendMessage<Settings>({ action: 'getSettings' });
      if (settingsRes.ok && settingsRes.data && !settingsRes.data.newTabPageEnabled) {
        setDisabled(true);
        return;
      }
      // Load workspaces
      const wsResult = await sendMessage<Workspace[]>({ action: 'getWorkspaces' });
      if (wsResult.ok && wsResult.data) {
        const cards: WorkspaceCardData[] = wsResult.data.map(ws => ({
          id: ws.id,
          name: ws.name,
          icon: ws.icon,
          tabCount: 0,
          groupCount: 0,
        }));
        setWorkspaces(cards);
      }

      // Load active workspace
      const activeResult = await sendMessage<Workspace>({ action: 'getActiveWorkspace' });
      if (activeResult.ok && activeResult.data) {
        setActiveWorkspaceId(activeResult.data.id);
      }

      // Load sessions
      const sessResult = await sendMessage<Session[]>({ action: 'getSessions' });
      if (sessResult.ok && sessResult.data) {
        setSessions(sessResult.data);
      }

      // Load weekly stats
      const statsResult = await sendMessage<DashboardStatsType>({
        action: 'getDashboardStats',
        range: 'week',
      });
      if (statsResult.ok && statsResult.data) {
        setStats(statsResult.data);
      }
    })();
  }, []);

  const handleSearch = useCallback(async (value: string) => {
    setQuery(value);
    setSelectedIndex(0);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    const response = await sendMessage<SearchResultItem[]>({
      action: 'searchTabs',
      query: value,
      scope: 'all',
    });

    if (response.ok && response.data) {
      setResults(response.data);
    }
  }, []);

  const switchToTab = useCallback(async (tabId: number, windowId?: number) => {
    try {
      await chrome.tabs.update(tabId, { active: true });
      if (windowId) {
        await chrome.windows.update(windowId, { focused: true });
      }
    } catch {
      // Tab may have been closed
    }
    setQuery('');
    setResults([]);
  }, []);

  const handleRestore = useCallback(async (sessionId: string) => {
    await sendMessage({ action: 'restoreSession', sessionId });
  }, []);

  if (disabled) {
    return (
      <div class={styles.page}>
        <div class={styles.empty}>New tab page is disabled. Enable it in Tabzen settings.</div>
      </div>
    );
  }

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <span class={styles.wordmark}>Tabzen</span>
        <a class={styles.settingsLink} href="chrome-extension://__MSG_@@extension_id__/options.html" target="_blank" rel="noopener">
          Settings
        </a>
      </div>

      <div class={styles.searchSection}>
        <SearchBar
          value={query}
          onChange={handleSearch}
          placeholder="Search tabs, sessions..."
          autoFocus
        />
        {showResults && (
          <div style={{ marginTop: 8 }}>
            <SearchResults
              results={results}
              selectedIndex={selectedIndex}
              onSelect={(tabId, windowId) => switchToTab(tabId, windowId)}
              visible
            />
          </div>
        )}
      </div>

      {workspaces.length > 0 && (
        <div class={styles.section}>
          <div class={styles.sectionTitle}>Workspaces</div>
          <WorkspaceCards
            workspaces={workspaces}
            activeId={activeWorkspaceId}
            onSelect={(id) => setActiveWorkspaceId(id)}
          />
        </div>
      )}

      <div class={styles.section}>
        <div class={styles.sectionTitle}>Recent Sessions</div>
        <SessionList sessions={sessions} onRestore={handleRestore} />
      </div>

      <div class={styles.section}>
        <div class={styles.sectionTitle}>This Week</div>
        <DashboardStats stats={stats} />
      </div>
    </div>
  );
}
