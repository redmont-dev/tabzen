import { useState, useEffect, useCallback } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import type { Session, RecentSessions } from '@/data/types';
import { SESSION_LIST_PAGE } from '@/shared/constants';
import styles from './SessionList.module.css';

export function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const loadSessions = useCallback(async (nextLimit: number) => {
    const res = await sendMessage<RecentSessions>({
      action: 'getRecentSessions',
      limit: nextLimit,
    });
    if (res.ok && res.data) {
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setLimit(nextLimit);
    }
  }, []);

  // A limit of 0 returns the count without any session bodies, which is all the
  // collapsed header needs. Rows are only fetched once the list is opened.
  useEffect(() => { loadSessions(0); }, [loadSessions]);

  const handleToggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && limit === 0) loadSessions(SESSION_LIST_PAGE);
  }, [expanded, limit, loadSessions]);

  const handleRestore = useCallback(async (sessionId: string) => {
    await sendMessage({ action: 'restoreSession', sessionId });
  }, []);

  const handleDelete = useCallback(async (sessionId: string) => {
    await sendMessage({ action: 'deleteSession', sessionId });
    loadSessions(Math.max(limit, SESSION_LIST_PAGE));
  }, [loadSessions, limit]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const sourceLabel = (source: string) => {
    if (source === 'auto') return 'Auto';
    if (source === 'close') return 'On close';
    return '';
  };

  return (
    <div class={styles.container}>
      <button
        class={styles.toggle}
        onClick={handleToggle}
      >
        <span class={styles.chevron}>{expanded ? '▼' : '▶'}</span>
        <span>Sessions</span>
        <span class={styles.count}>{total}</span>
      </button>

      {expanded && (
        <div class={styles.list}>
          {total === 0 ? (
            <div class={styles.empty}>No saved sessions</div>
          ) : (
            sessions.map(s => (
              <div key={s.id} class={styles.item}>
                <div class={styles.itemMain}>
                  <span class={styles.name}>{s.name}</span>
                  <span class={styles.meta}>
                    {s.tabs.length} tabs
                    {s.source !== 'manual' && ` · ${sourceLabel(s.source)}`}
                  </span>
                </div>
                <div class={styles.itemRight}>
                  <span class={styles.date}>{formatDate(s.createdAt)}</span>
                  <button class={styles.action} onClick={() => handleRestore(s.id)} title="Restore">↗</button>
                  <button class={styles.action} onClick={() => handleDelete(s.id)} title="Delete">✕</button>
                </div>
              </div>
            ))
          )}
          {sessions.length < total && (
            <button
              class={styles.toggle}
              onClick={() => loadSessions(limit + SESSION_LIST_PAGE)}
            >
              <span>Show more ({sessions.length} of {total})</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
