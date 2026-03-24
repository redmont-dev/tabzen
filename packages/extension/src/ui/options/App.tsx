import { useState, useEffect, useCallback } from 'preact/hooks';
import type { Settings, Workspace } from '@/data/types';
import { sendMessage } from '@/hooks/use-message';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { GeneralSection } from './sections/GeneralSection';
import { WorkspacesSection } from './sections/WorkspacesSection';
import { GroupingRulesSection } from './sections/GroupingRulesSection';
import { PriorityUrlsSection } from './sections/PriorityUrlsSection';
import { SortingSection } from './sections/SortingSection';
import { DuplicatesSection } from './sections/DuplicatesSection';
import { SessionsSection } from './sections/SessionsSection';
import { SyncSection } from './sections/SyncSection';
import { KeyboardShortcutsSection } from './sections/KeyboardShortcutsSection';
import { AnalyticsSection } from './sections/AnalyticsSection';
import { RulePacksSection } from './sections/RulePacksSection';
import { PrivacySection } from './sections/PrivacySection';
import { AboutSection } from './sections/AboutSection';
import styles from './App.module.css';

type Section =
  | 'general' | 'workspaces' | 'grouping-rules' | 'priority-urls'
  | 'sorting' | 'duplicates' | 'sessions' | 'sync'
  | 'keyboard-shortcuts' | 'analytics' | 'rule-packs' | 'privacy' | 'about';

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'grouping-rules', label: 'Grouping Rules' },
  { id: 'priority-urls', label: 'Priority URLs' },
  { id: 'sorting', label: 'Sorting' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'sync', label: 'Sync' },
  { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'rule-packs', label: 'Rule Packs' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'about', label: 'About' },
];

export function App() {
  const [active, setActive] = useState<Section>('general');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const [settingsRes, workspacesRes] = await Promise.all([
      sendMessage<Settings>({ action: 'getSettings' }),
      sendMessage<Workspace[]>({ action: 'getWorkspaces' }),
    ]);
    if (settingsRes.ok && settingsRes.data) setSettings(settingsRes.data);
    if (workspacesRes.ok && workspacesRes.data) setWorkspaces(workspacesRes.data);
    setLoaded(true);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdateSettings = useCallback(async (patch: Partial<Settings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await sendMessage({ action: 'updateSettings', settings: patch });
  }, [settings]);

  const activeWorkspace = workspaces.find(w => w.id === settings.activeWorkspaceId) ?? workspaces[0] ?? null;

  const renderSection = () => {
    if (!loaded) {
      return <div class={styles.fieldDescription}>Loading...</div>;
    }

    switch (active) {
      case 'general':
        return <GeneralSection settings={settings} onUpdate={handleUpdateSettings} />;
      case 'workspaces':
        return <WorkspacesSection workspaces={workspaces} onRefresh={loadData} />;
      case 'grouping-rules':
        return <GroupingRulesSection workspace={activeWorkspace} onRefresh={loadData} />;
      case 'priority-urls':
        return <PriorityUrlsSection workspace={activeWorkspace} onRefresh={loadData} />;
      case 'sorting':
        return <SortingSection settings={settings} onUpdate={handleUpdateSettings} />;
      case 'duplicates':
        return <DuplicatesSection settings={settings} onUpdate={handleUpdateSettings} />;
      case 'sessions':
        return <SessionsSection settings={settings} onUpdate={handleUpdateSettings} />;
      case 'sync':
        return <SyncSection />;
      case 'keyboard-shortcuts':
        return <KeyboardShortcutsSection />;
      case 'analytics':
        return <AnalyticsSection />;
      case 'rule-packs':
        return <RulePacksSection />;
      case 'privacy':
        return <PrivacySection settings={settings} onUpdate={handleUpdateSettings} />;
      case 'about':
        return <AboutSection />;
    }
  };

  return (
    <div class={styles.layout}>
      <nav class={styles.sidebar}>
        <div class={styles.sidebarHeader}>Tabzen</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            class={`${styles.navItem} ${active === item.id ? styles.navItemActive : ''}`}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main class={styles.main}>
        {renderSection()}
      </main>
    </div>
  );
}
