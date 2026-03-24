import type { DashboardStats as DashboardStatsType } from '@/data/types';
import styles from './DashboardStats.module.css';

interface DashboardStatsProps {
  stats: DashboardStatsType | null;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  if (!stats) return null;

  return (
    <div class={styles.grid}>
      <div class={styles.stat}>
        <div class={styles.statValue}>{stats.peakTabCount}</div>
        <div class={styles.statLabel}>Peak tabs</div>
      </div>
      <div class={styles.stat}>
        <div class={styles.statValue}>{stats.duplicatesBlocked}</div>
        <div class={styles.statLabel}>Dupes blocked</div>
      </div>
      <div class={styles.stat}>
        <div class={styles.statValue}>{stats.sessionsUsed}</div>
        <div class={styles.statLabel}>Sessions saved</div>
      </div>
    </div>
  );
}
