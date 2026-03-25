import { useState, useCallback, useEffect } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import { useKeyboardNav } from '@/hooks/use-keyboard';
import type { Settings, Session } from '@/data/types';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { SearchBar } from '../components/SearchBar';
import { SearchResults, type SearchResultItem } from '../components/SearchResults';
import { ToastContainer, showToast } from '../components/Toast';
import { StatusLine } from './StatusLine';
import { ActionList } from './ActionList';
import styles from './App.module.css';

export function App() {
  const [tabCount, setTabCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const showResults = query.length > 0 && results.length > 0;

  // Fetch initial state
  useEffect(() => {
    (async () => {
      const win = await chrome.windows.getCurrent();
      if (!win.id) return;
      setWindowId(win.id);

      const infoRes = await sendMessage<{ tabs: chrome.tabs.Tab[]; groups: chrome.tabGroups.TabGroup[] }>({
        action: 'getWindowInfo',
        windowId: win.id,
      });
      if (infoRes.ok && infoRes.data) {
        setTabCount(infoRes.data.tabs.length);
        setGroupCount(infoRes.data.groups.length);
      }

      const settingsRes = await sendMessage<Settings>({ action: 'getSettings' });
      if (settingsRes.ok && settingsRes.data) {
        setSettings(settingsRes.data);
      }

      const sessRes = await sendMessage<Session[]>({ action: 'getSessions' });
      if (sessRes.ok && sessRes.data) {
        setSessions(sessRes.data.sort((a, b) => b.createdAt - a.createdAt));
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
      scope: 'tabs',
    });

    if (response.ok && response.data) {
      setResults(response.data);
    }
  }, []);

  const switchToTab = useCallback(async (tabId: number, wId?: number) => {
    try {
      await chrome.tabs.update(tabId, { active: true });
      if (wId) {
        await chrome.windows.update(wId, { focused: true });
      }
      window.close();
    } catch {
      // Tab may have been closed
    }
  }, []);

  const refreshCounts = useCallback(async () => {
    if (!windowId) return;
    const infoRes = await sendMessage<{ tabs: chrome.tabs.Tab[]; groups: chrome.tabGroups.TabGroup[] }>({
      action: 'getWindowInfo',
      windowId,
    });
    if (infoRes.ok && infoRes.data) {
      setTabCount(infoRes.data.tabs.length);
      setGroupCount(infoRes.data.groups.length);
    }
  }, [windowId]);

  const handleCleanUp = useCallback(async () => {
    if (!windowId) return;
    await sendMessage({ action: 'cleanUp', windowId });
    showToast('Cleaned up');
    await refreshCounts();
  }, [windowId, refreshCounts]);

  const handleSaveSession = useCallback(async () => {
    if (!windowId) return;
    await sendMessage({ action: 'saveSession', windowId });
    showToast('Session saved');
    // Reload sessions
    const sessRes = await sendMessage<Session[]>({ action: 'getSessions' });
    if (sessRes.ok && sessRes.data) {
      setSessions(sessRes.data.sort((a, b) => b.createdAt - a.createdAt));
    }
  }, [windowId]);

  const handleRemoveDuplicates = useCallback(async () => {
    if (!windowId) return;
    const res = await sendMessage<{ removed: number }>({ action: 'removeDuplicates', windowId });
    const removed = res.ok && res.data ? res.data.removed : 0;
    showToast(removed > 0 ? `Removed ${removed} duplicate${removed !== 1 ? 's' : ''}` : 'No duplicates found');
    await refreshCounts();
  }, [windowId, refreshCounts]);

  const handleCollapseAll = useCallback(async () => {
    if (!windowId) return;
    await sendMessage({ action: 'collapseAll', windowId });
    showToast('Groups collapsed');
  }, [windowId]);

  const handleSortTabsByTitle = useCallback(async () => {
    if (!windowId) return;
    await sendMessage({ action: 'sortTabs', windowId, sortBy: 'title', sortOrder: 'asc' });
    setSettings(prev => ({ ...prev, defaultSortBy: 'title', defaultSortOrder: 'asc' }));
    showToast('Sorted by title (A\u2192Z)');
  }, [windowId]);

  const handleSortTabsByUrl = useCallback(async () => {
    if (!windowId) return;
    await sendMessage({ action: 'sortTabs', windowId, sortBy: 'url', sortOrder: 'asc' });
    setSettings(prev => ({ ...prev, defaultSortBy: 'url', defaultSortOrder: 'asc' }));
    showToast('Sorted by URL (A\u2192Z)');
  }, [windowId]);

  const handleSortGroupsByName = useCallback(async () => {
    if (!windowId) return;
    await sendMessage({ action: 'sortGroups', windowId, mode: 'name' });
    showToast('Sorted groups by name');
  }, [windowId]);

  const handleSortGroupsByColor = useCallback(async () => {
    if (!windowId) return;
    await sendMessage({ action: 'sortGroups', windowId, mode: 'color' });
    showToast('Sorted groups by color');
  }, [windowId]);

  const handleRestoreSession = useCallback(async (sessionId: string) => {
    await sendMessage({ action: 'restoreSession', sessionId });
    showToast('Session restored');
  }, []);

  const handleOpenPanel = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch {
      await chrome.sidePanel.setOptions({ enabled: true });
    }
    window.close();
  }, []);

  useKeyboardNav({
    itemCount: results.length,
    selectedIndex,
    onSelect: setSelectedIndex,
    onConfirm: (index) => {
      const r = results[index];
      if (r) switchToTab(r.tabId, r.windowId);
    },
    onDismiss: () => {
      setQuery('');
      setResults([]);
    },
    enabled: showResults,
  });

  const quickActions = [
    { label: 'Clean up', hint: '\u2318\u21E7U', onClick: handleCleanUp },
    { label: 'Save session', hint: '\u2318\u21E7S', onClick: handleSaveSession },
  ];

  const sortActions = [
    { label: 'Sort tabs by title', hint: 'A\u2192Z', onClick: handleSortTabsByTitle },
    { label: 'Sort tabs by URL', hint: 'A\u2192Z', onClick: handleSortTabsByUrl },
    { label: 'Sort groups by name', onClick: handleSortGroupsByName },
    { label: 'Sort groups by color', onClick: handleSortGroupsByColor },
  ];

  const moreActions = [
    { label: 'Remove duplicates', onClick: handleRemoveDuplicates },
    { label: 'Collapse all groups', onClick: handleCollapseAll },
  ];

  const recentSessions = sessions.slice(0, 5);

  return (
    <div class={styles.popup}>
      <StatusLine
        tabCount={tabCount}
        groupCount={groupCount}
        workspaceName="Default"
        onOpenPanel={handleOpenPanel}
      />

      <div class={styles.searchSection}>
        <SearchBar
          value={query}
          onChange={handleSearch}
          shortcutHint="&#8984;&#8679;K"
        />
      </div>

      {showResults && (
        <div class={styles.searchResults}>
          <SearchResults
            results={results}
            selectedIndex={selectedIndex}
            onSelect={(tabId, wId) => switchToTab(tabId, wId)}
            visible
          />
        </div>
      )}

      <div class={styles.section}>
        <div class={styles.sectionHeader}>Quick Actions</div>
        <ActionList actions={quickActions} />
      </div>

      <div class={styles.section}>
        <div class={styles.sectionHeader}>Sort</div>
        <ActionList actions={sortActions} />
      </div>

      <div class={styles.section}>
        <button
          class={styles.sessionsToggle}
          onClick={() => setSessionsExpanded(!sessionsExpanded)}
        >
          <span class={styles.sectionHeader} style={{ marginBottom: 0 }}>Sessions</span>
          <span class={styles.sessionsBadge}>{sessions.length}</span>
        </button>
        {sessionsExpanded && (
          <div class={styles.sessionsList}>
            {recentSessions.length === 0 ? (
              <div class={styles.sessionsEmpty}>No saved sessions</div>
            ) : (
              recentSessions.map(s => (
                <button key={s.id} class={styles.sessionItem} onClick={() => handleRestoreSession(s.id)}>
                  <span class={styles.sessionName}>{s.name}</span>
                  <span class={styles.sessionMeta}>{s.tabs.length} tabs</span>
                  <span class={styles.sessionRestore}>{'\u2197'}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div class={styles.section}>
        <div class={styles.sectionHeader}>More</div>
        <ActionList actions={moreActions} />
      </div>

      <div class={styles.footer}>
        <a class={styles.footerLink} onClick={() => chrome.runtime.openOptionsPage()}>
          Settings
        </a>
        <a
          class={styles.footerLink}
          onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          Shortcuts
        </a>
        <span class={styles.workspace}>Default</span>
      </div>

      <ToastContainer />
    </div>
  );
}
