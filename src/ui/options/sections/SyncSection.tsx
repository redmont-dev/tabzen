import { useState, useEffect, useCallback } from 'preact/hooks';
import { sendMessage } from '@/hooks/use-message';
import type { SyncStatus } from '@/data/types';
import styles from '../App.module.css';

export function SyncSection() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const res = await sendMessage<SyncStatus>({ action: 'getSyncStatus' });
    if (res.ok && res.data) {
      setStatus(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleToggleSync = async () => {
    clearMessages();
    if (status?.enabled) {
      setActionLoading('disable');
      const res = await sendMessage({ action: 'disableSync' });
      if (!res.ok) {
        setError(res.error ?? 'Failed to disable sync');
      }
      setActionLoading(null);
    } else {
      setActionLoading('enable');
      const res = await sendMessage({ action: 'enableSync' });
      if (!res.ok) {
        setError(res.error ?? 'Failed to enable sync. Make sure you are signed in to Chrome.');
      }
      setActionLoading(null);
    }
    await loadStatus();
  };

  const handleSyncNow = async () => {
    clearMessages();
    setActionLoading('sync');
    const res = await sendMessage<{ synced: number; lastSyncTime: number }>({ action: 'syncSessions' });
    if (res.ok && res.data) {
      setSuccessMsg(`Synced ${res.data.synced} session${res.data.synced !== 1 ? 's' : ''} to Google Drive.`);
    } else {
      setError(res.error ?? 'Sync failed');
    }
    setActionLoading(null);
    await loadStatus();
  };

  const handleImport = async () => {
    clearMessages();
    setActionLoading('import');
    const res = await sendMessage<{ imported: number }>({ action: 'importFromDrive' });
    if (res.ok && res.data) {
      setSuccessMsg(`Imported ${res.data.imported} session${res.data.imported !== 1 ? 's' : ''} from Google Drive.`);
    } else {
      setError(res.error ?? 'Import failed');
    }
    setActionLoading(null);
    await loadStatus();
  };

  const formatTime = (ts: number | null): string => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    return d.toLocaleString();
  };

  if (loading && !status) {
    return (
      <div>
        <h2 class={styles.pageTitle}>Sync</h2>
        <div class={styles.fieldDescription}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 class={styles.pageTitle}>Sync</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.sectionLabel}>Google Drive</div>
        <div class={styles.fieldDescription} style={{ marginBottom: 16 }}>
          Back up your sessions to a hidden app folder in Google Drive.
          Only Tabzen can access these files. Settings and rules sync
          automatically via Chrome and are not included in Drive sync.
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Enable Google Drive sync</div>
            <div class={styles.fieldDescription}>
              {status?.enabled ? 'Connected' : 'Not connected'}
            </div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={status?.enabled ?? false}
            disabled={actionLoading !== null}
            onChange={handleToggleSync}
          />
        </div>
      </div>

      {status?.enabled && (
        <div class={styles.sectionBlock}>
          <div class={styles.sectionLabel}>Status</div>

          <div class={styles.field}>
            <div class={styles.fieldLabel}>Last sync</div>
            <div class={styles.fieldDescription}>
              {formatTime(status.lastSyncTime)}
            </div>
          </div>

          <div class={styles.field}>
            <div class={styles.fieldLabel}>Sessions in Drive</div>
            <div class={styles.fieldDescription}>
              {status.sessionCount}
            </div>
          </div>
        </div>
      )}

      {status?.enabled && (
        <div class={styles.sectionBlock}>
          <div class={styles.sectionLabel}>Actions</div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              class={styles.button}
              disabled={actionLoading !== null}
              onClick={handleSyncNow}
            >
              {actionLoading === 'sync' ? 'Syncing...' : 'Sync Now'}
            </button>

            <button
              class={styles.button}
              disabled={actionLoading !== null}
              onClick={handleImport}
            >
              {actionLoading === 'import' ? 'Importing...' : 'Import from Drive'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div class={styles.sectionBlock}>
          <div style={{ color: 'var(--group-red)', fontSize: 12 }}>{error}</div>
        </div>
      )}

      {successMsg && (
        <div class={styles.sectionBlock}>
          <div style={{ color: 'var(--group-green)', fontSize: 12 }}>{successMsg}</div>
        </div>
      )}
    </div>
  );
}
