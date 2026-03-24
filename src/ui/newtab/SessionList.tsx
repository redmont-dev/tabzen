import type { Session } from '@/data/types';
import styles from './SessionList.module.css';

interface SessionListProps {
  sessions: Session[];
  onRestore: (sessionId: string) => void;
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function SessionList({ sessions, onRestore }: SessionListProps) {
  if (sessions.length === 0) {
    return <div class={styles.list} style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>No saved sessions</div>;
  }

  // Show most recent 5
  const recent = sessions
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div class={styles.list}>
      {recent.map(session => (
        <div
          key={session.id}
          class={styles.item}
          onClick={() => onRestore(session.id)}
          role="button"
          tabIndex={0}
        >
          <span class={styles.name}>{session.name}</span>
          <div class={styles.meta}>
            <span class={styles.tabCount}>
              {session.tabs.length} {session.tabs.length === 1 ? 'tab' : 'tabs'}
            </span>
            <span>{formatRelativeDate(session.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
