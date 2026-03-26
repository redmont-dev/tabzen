import type { DashboardStats as DashboardStatsType } from '@/data/types';
import styles from './DashboardStats.module.css';

const COLOR_MAP: Record<string, string> = {
  grey: '#999', blue: '#3b82f6', red: '#ef4444', yellow: '#eab308',
  green: '#22c55e', pink: '#ec4899', purple: '#a855f7', cyan: '#06b6d4', orange: '#f97316',
};

interface DashboardStatsProps {
  stats: DashboardStatsType | null;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  if (!stats) return null;

  const maxDomainCount = stats.topDomains.length > 0
    ? Math.max(...stats.topDomains.map(d => d.count))
    : 1;

  return (
    <div>
      <div class={styles.sectionLabel}>This week</div>
      <div class={styles.grid}>
        <div class={styles.stat}>
          <div class={styles.statValue}>{stats.tabsOpened}</div>
          <div class={styles.statLabel}>tabs open</div>
        </div>
        <div class={styles.stat}>
          <div class={styles.statValue}>{stats.duplicatesBlocked}</div>
          <div class={styles.statLabel}>dupes blocked</div>
        </div>
        <div class={styles.stat}>
          <div class={styles.statValue}>{stats.sessionsUsed}</div>
          <div class={styles.statLabel}>sessions saved</div>
        </div>
      </div>

      {stats.topDomains.length > 0 && (
        <>
          <div class={styles.sectionLabel} style={{ marginTop: 24 }}>Top domains</div>
          <div class={styles.domainList}>
            {stats.topDomains.map(d => (
              <div key={d.domain} class={styles.domainRow}>
                <div class={styles.domainInfo}>
                  <span class={styles.domainName}>{d.domain}</span>
                  <span class={styles.domainCount}>{d.count}</span>
                </div>
                <div class={styles.domainBar}>
                  <div
                    class={styles.domainBarFill}
                    style={{ width: `${(d.count / maxDomainCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {stats.groupUsage.length > 0 && (
        <>
          <div class={styles.sectionLabel} style={{ marginTop: 24 }}>Groups</div>
          <div class={styles.groupGrid}>
            {stats.groupUsage.map(g => (
              <div key={g.name} class={styles.groupCard}>
                <div class={styles.groupHeader}>
                  <span
                    class={styles.groupDot}
                    style={{ background: COLOR_MAP[g.color] || '#999' }}
                  />
                  <span class={styles.groupName}>{g.name}</span>
                </div>
                <div class={styles.groupCount}>{g.count}</div>
                <div class={styles.groupCountLabel}>tabs</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
