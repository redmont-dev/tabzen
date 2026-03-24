import { useState, useCallback } from 'preact/hooks';
import { GroupHeader } from '../components/GroupHeader';
import { TabItem } from '../components/TabItem';
import type { GroupInfo, TabInfo } from '@/hooks/use-tabs';
import styles from './TabTree.module.css';

interface TabTreeProps {
  groups: GroupInfo[];
  ungroupedTabs: TabInfo[];
  onActivateTab: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
}

export function TabTree({ groups, ungroupedTabs, onActivateTab, onCloseTab }: TabTreeProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = useCallback((groupId: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  return (
    <div class={styles.tree}>
      {groups.map(group => {
        const isCollapsed = collapsedGroups.has(group.id);
        return (
          <div key={group.id} class={styles.groupSection}>
            <GroupHeader
              title={group.title}
              color={group.color}
              tabCount={group.tabs.length}
              collapsed={isCollapsed}
              onToggle={() => toggleGroup(group.id)}
            />
            {!isCollapsed && (
              <div class={styles.groupTabs}>
                {group.tabs.map(tab => (
                  <TabItem
                    key={tab.id}
                    id={tab.id}
                    title={tab.title}
                    url={tab.url}
                    favIconUrl={tab.favIconUrl}
                    active={tab.active}
                    onActivate={onActivateTab}
                    onClose={onCloseTab}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {ungroupedTabs.length > 0 && (
        <div class={styles.ungroupedSection}>
          <div class={styles.ungroupedLabel}>Ungrouped</div>
          {ungroupedTabs.map(tab => (
            <TabItem
              key={tab.id}
              id={tab.id}
              title={tab.title}
              url={tab.url}
              favIconUrl={tab.favIconUrl}
              active={tab.active}
              ungrouped
              onActivate={onActivateTab}
              onClose={onCloseTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}
