import { useState, useCallback } from 'preact/hooks';
import { useTabs } from '@/hooks/use-tabs';
import { useKeyboardNav } from '@/hooks/use-keyboard';
import { sendMessage } from '@/hooks/use-message';
import { SearchBar } from '../components/SearchBar';
import { SearchResults, type SearchResultItem } from '../components/SearchResults';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { QuickActions } from './QuickActions';
import { TabTree } from './TabTree';
import { TabzenLogo } from '../components/TabzenLogo';
import styles from './App.module.css';

export function App() {
  const { state, loading } = useTabs();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const showResults = query.length > 0 && results.length > 0;

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

  const closeTab = useCallback(async (tabId: number) => {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // Tab may already be closed
    }
  }, []);

  const handleCleanUp = useCallback(async () => {
    if (!state) return;
    await sendMessage({ action: 'cleanUp', windowId: state.windowId });
  }, [state]);

  const handleSave = useCallback(() => {
    // Placeholder — Plan 4 (SessionManager)
  }, []);

  const handleCollapseAll = useCallback(async () => {
    if (!state) return;
    await sendMessage({ action: 'collapseAll', windowId: state.windowId });
  }, [state]);

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

  if (loading) {
    return <div class={styles.loading}>Loading...</div>;
  }

  return (
    <div class={styles.panel}>
      <div class={styles.header}>
        <TabzenLogo size={16} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
          onClick={() => chrome.runtime.openOptionsPage()}>Settings</span>
      </div>
      <WorkspaceSwitcher activeWorkspace="Default" />

      <div class={styles.searchSection}>
        <SearchBar
          value={query}
          onChange={handleSearch}
          shortcutHint="&#8984;&#8679;K"
          autoFocus
        />
      </div>

      {showResults && (
        <div class={styles.searchResults}>
          <SearchResults
            results={results}
            selectedIndex={selectedIndex}
            onSelect={(tabId, windowId) => switchToTab(tabId, windowId)}
            visible
          />
        </div>
      )}

      <QuickActions
        onCleanUp={handleCleanUp}
        onSave={handleSave}
        onCollapseAll={handleCollapseAll}
      />

      {state && (
        <TabTree
          groups={state.groups}
          ungroupedTabs={state.ungroupedTabs}
          onActivateTab={(id) => switchToTab(id)}
          onCloseTab={closeTab}
        />
      )}
    </div>
  );
}
