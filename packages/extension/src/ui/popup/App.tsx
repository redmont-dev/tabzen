import { useState, useCallback, useEffect } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import { useKeyboardNav } from '@/hooks/use-keyboard';
import type { Settings, Session, SortBy, SortOrder } from '@/data/types';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { SearchBar } from '../components/SearchBar';
import { SearchResults, type SearchResultItem } from '../components/SearchResults';
import { ToastContainer, showToast } from '../components/Toast';
import { StatusLine } from './StatusLine';
import { ActionList } from './ActionList';
import { SortSection } from './SortSection';
import styles from './App.module.css';

export function App() {
  const [tabCount, setTabCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const showResults = query.length > 0 && results.length > 0;

  const loadSessions = useCallback(async () => {
    const res = await sendMessage<Session[]>({ action: 'getSessions' });
    if (res.ok && res.data) {
      setSessions(res.data.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
    }
  }, []);

  const refreshCounts = useCallback(async (wId: number) => {
    const infoRes = await sendMessage<{ tabs: chrome.tabs.Tab[]; groups: chrome.tabGroups.TabGroup[] }>({
      action: 'getWindowInfo',
      windowId: wId,
    });
    if (infoRes.ok && infoRes.data) {
      setTabCount(infoRes.data.tabs.length);
      setGroupCount(infoRes.data.groups.length);
    }
  }, []);

  // Fetch initial state
  useEffect(() => {
    (async () => {
      const win = await chrome.windows.getCurrent();
      if (!win.id) return;
      setWindowId(win.id);

      await refreshCounts(win.id);

      const settingsRes = await sendMessage<Settings>({ action: 'getSettings' });
      if (settingsRes.ok && settingsRes.data) {
        setSettings(settingsRes.data);
      }

      loadSessions();
    })();
  }, [refreshCounts, loadSessions]);

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

  const runAction = useCallback(async (action: string) => {
    if (!windowId) return;

    switch (action) {
      case 'cleanUp':
        await sendMessage({ action: 'cleanUp', windowId });
        showToast('Cleaned up');
        break;
      case 'removeDuplicates': {
        const res = await sendMessage<number>({ action: 'removeDuplicates', windowId });
        const count = res.ok && res.data ? res.data : 0;
        showToast(count > 0 ? `Removed ${count} duplicate${count !== 1 ? 's' : ''}` : 'No duplicates found');
        break;
      }
      case 'collapseAll':
        await sendMessage({ action: 'collapseAll', windowId });
        showToast('Groups collapsed');
        break;
      case 'saveSession':
        await sendMessage({ action: 'saveSession', windowId });
        showToast('Session saved');
        loadSessions();
        break;
    }

    await refreshCounts(windowId);
  }, [windowId, refreshCounts, loadSessions]);

  const handleSort = useCallback(async (sortBy: SortBy, sortOrder: SortOrder) => {
    if (!windowId) return;
    await sendMessage({ action: 'sortTabs', windowId, sortBy, sortOrder });
    setSettings(prev => ({ ...prev, defaultSortBy: sortBy, defaultSortOrder: sortOrder }));
    showToast(`Sorted by ${sortBy} (${sortOrder === 'asc' ? 'A→Z' : 'Z→A'})`);
  }, [windowId]);

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

  const actions = [
    { label: 'Clean up', hint: '\u2318\u21E7U', onClick: () => runAction('cleanUp') },
    { label: 'Save session', hint: '\u2318\u21E7S', onClick: () => runAction('saveSession') },
    { label: 'Remove duplicates', onClick: () => runAction('removeDuplicates') },
    { label: 'Collapse all groups', onClick: () => runAction('collapseAll') },
  ];

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

      <ActionList actions={actions} />

      <div class={styles.section}>
        <button
          class={styles.sectionToggle}
          onClick={() => setShowSessions(!showSessions)}
        >
          <span>{showSessions ? '▼' : '▶'} Sessions</span>
          <span class={styles.sectionCount}>{sessions.length}</span>
        </button>
        {showSessions && (
          <div class={styles.sessionList}>
            {sessions.length === 0 ? (
              <div class={styles.sessionEmpty}>No saved sessions</div>
            ) : (
              sessions.map(s => (
                <div key={s.id} class={styles.sessionItem}>
                  <div class={styles.sessionInfo}>
                    <span class={styles.sessionName}>{s.name}</span>
                    <span class={styles.sessionMeta}>{s.tabs.length} tabs</span>
                  </div>
                  <button
                    class={styles.sessionRestore}
                    onClick={async () => {
                      await sendMessage({ action: 'restoreSession', sessionId: s.id });
                      showToast('Session restored');
                    }}
                    title="Restore"
                  >↗</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <SortSection
        sortBy={settings.defaultSortBy}
        sortOrder={settings.defaultSortOrder}
        onSort={handleSort}
      />

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
