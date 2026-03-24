import { useState, useEffect, useCallback } from 'preact/hooks';
import type { DashboardStats, AnalyticsTimeRange } from '@/data/types';
import { sendMessage } from '@/hooks/use-message';
import styles from '../App.module.css';

const TIME_RANGES: { label: string; value: AnalyticsTimeRange }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: '90 days', value: '90d' },
];

export function AnalyticsSection() {
  const [range, setRange] = useState<AnalyticsTimeRange>('week');
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadStats = useCallback(async (r: AnalyticsTimeRange) => {
    const res = await sendMessage<DashboardStats>({ action: 'getDashboardStats', range: r });
    if (res.ok && res.data) {
      setStats(res.data);
    }
  }, []);

  useEffect(() => {
    loadStats(range);
  }, [range, loadStats]);

  const maxDomain = stats?.topDomains.reduce((m, d) => Math.max(m, d.count), 0) ?? 1;
  const maxGroup = stats?.groupUsage.reduce((m, g) => Math.max(m, g.count), 0) ?? 1;

  return (
    <div>
      <h2 class={styles.pageTitle}>Analytics</h2>

      <div class={styles.timePeriodSelector}>
        {TIME_RANGES.map(tr => (
          <button
            key={tr.value}
            class={`${styles.timePeriodButton} ${range === tr.value ? styles.timePeriodButtonActive : ''}`}
            onClick={() => setRange(tr.value)}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {stats ? (
        <>
          <div class={styles.statsGrid}>
            <div class={styles.statCard}>
              <div class={styles.statValue}>{stats.tabsOpened}</div>
              <div class={styles.statLabel}>Tabs opened</div>
            </div>
            <div class={styles.statCard}>
              <div class={styles.statValue}>{stats.peakTabCount}</div>
              <div class={styles.statLabel}>Peak tab count</div>
            </div>
            <div class={styles.statCard}>
              <div class={styles.statValue}>{stats.duplicatesBlocked}</div>
              <div class={styles.statLabel}>Duplicates blocked</div>
            </div>
            <div class={styles.statCard}>
              <div class={styles.statValue}>{stats.sessionsUsed}</div>
              <div class={styles.statLabel}>Sessions used</div>
            </div>
          </div>

          {stats.topDomains.length > 0 && (
            <div class={styles.sectionBlock}>
              <div class={styles.sectionLabel}>Top Domains</div>
              <div class={styles.barChart}>
                {stats.topDomains.map(d => (
                  <div key={d.domain} class={styles.barRow}>
                    <div class={styles.barLabel}>{d.domain}</div>
                    <div class={styles.bar} style={{ width: `${(d.count / maxDomain) * 100}%`, minWidth: 2 }} />
                    <div class={styles.barValue}>{d.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.groupUsage.length > 0 && (
            <div class={styles.sectionBlock}>
              <div class={styles.sectionLabel}>Group Usage</div>
              <div class={styles.barChart}>
                {stats.groupUsage.map(g => (
                  <div key={g.name} class={styles.barRow}>
                    <div class={styles.barLabel}>{g.name}</div>
                    <div
                      class={styles.bar}
                      style={{
                        width: `${(g.count / maxGroup) * 100}%`,
                        minWidth: 2,
                        background: `var(--group-${g.color}, var(--text-primary))`,
                        opacity: 0.4,
                      }}
                    />
                    <div class={styles.barValue}>{g.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div class={styles.fieldDescription}>Loading analytics data...</div>
      )}
    </div>
  );
}
