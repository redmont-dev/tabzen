import { useState, useCallback, useEffect } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import { useKeyboardNav } from '@/hooks/use-keyboard';
import type { Settings, SortBy, SortOrder } from '@/data/types';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { SearchBar } from '../components/SearchBar';
import { SearchResults, type SearchResultItem } from '../components/SearchResults';
import { StatusLine } from './StatusLine';
import { ActionList } from './ActionList';
import { SortSection } from './SortSection';
import styles from './App.module.css';

export function App() {
  const [tabCount, setTabCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
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
      window.close(); // Close the popup after switching
    } catch {
      // Tab may have been closed
    }
  }, []);

  const runAction = useCallback(async (action: string) => {
    if (!windowId) return;

    switch (action) {
      case 'cleanUp':
        await sendMessage({ action: 'cleanUp', windowId });
        break;
      case 'removeDuplicates':
        await sendMessage({ action: 'removeDuplicates', windowId });
        break;
      case 'collapseAll':
        await sendMessage({ action: 'collapseAll', windowId });
        break;
    }

    // Refresh counts after action
    const infoRes = await sendMessage<{ tabs: chrome.tabs.Tab[]; groups: chrome.tabGroups.TabGroup[] }>({
      action: 'getWindowInfo',
      windowId,
    });
    if (infoRes.ok && infoRes.data) {
      setTabCount(infoRes.data.tabs.length);
      setGroupCount(infoRes.data.groups.length);
    }
  }, [windowId]);

  const handleSort = useCallback(async (sortBy: SortBy, sortOrder: SortOrder) => {
    if (!windowId) return;
    await sendMessage({ action: 'sortTabs', windowId, sortBy, sortOrder });
    setSettings(prev => ({ ...prev, defaultSortBy: sortBy, defaultSortOrder: sortOrder }));
  }, [windowId]);

  const handleOpenPanel = useCallback(() => {
    // Open side panel. chrome.sidePanel.open requires user gesture,
    // which a click in the popup satisfies.
    chrome.sidePanel.setOptions({ enabled: true });
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
    { label: 'Save session', hint: '\u2318\u21E7S', disabled: true, onClick: () => {} },
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
    </div>
  );
}
