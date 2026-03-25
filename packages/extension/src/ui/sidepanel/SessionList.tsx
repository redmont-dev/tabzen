import { useState, useEffect, useCallback } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import type { Session } from '@/data/types';
import styles from './SessionList.module.css';

export function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expanded, setExpanded] = useState(false);

  const loadSessions = useCallback(async () => {
    const res = await sendMessage<Session[]>({ action: 'getSessions' });
    if (res.ok && res.data) {
      setSessions(res.data.sort((a, b) => b.createdAt - a.createdAt));
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleRestore = useCallback(async (sessionId: string) => {
    await sendMessage({ action: 'restoreSession', sessionId });
  }, []);

  const handleDelete = useCallback(async (sessionId: string) => {
    await sendMessage({ action: 'deleteSession', sessionId });
    loadSessions();
  }, [loadSessions]);

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
        onClick={() => setExpanded(!expanded)}
      >
        <span class={styles.chevron}>{expanded ? '▼' : '▶'}</span>
        <span>Sessions</span>
        <span class={styles.count}>{sessions.length}</span>
      </button>

      {expanded && (
        <div class={styles.list}>
          {sessions.length === 0 ? (
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
        </div>
      )}
    </div>
  );
}
