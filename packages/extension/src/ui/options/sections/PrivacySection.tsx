import { useCallback } from 'preact/hooks';
import type { Settings } from '@/data/types';
import styles from '../App.module.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

export function PrivacySection({ settings, onUpdate }: Props) {
  const handleClearData = useCallback(async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.clear();
      window.location.reload();
    }
  }, []);

  const handleExportData = useCallback(async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get(null);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tabzen-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  return (
    <div>
      <h2 class={styles.pageTitle}>Privacy</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Telemetry</div>
            <div class={styles.fieldDescription}>Send anonymous usage data to help improve Tabzen</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.telemetryEnabled}
            onChange={(e) => onUpdate({ telemetryEnabled: (e.target as HTMLInputElement).checked })}
          />
        </div>
      </div>

      <div class={styles.sectionBlock}>
        <div class={styles.sectionLabel}>Data Management</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button class={styles.button} onClick={handleExportData}>
            Export all data
          </button>
          <button class={`${styles.button} ${styles.buttonDanger}`} onClick={handleClearData}>
            Clear all data
          </button>
        </div>

        <div class={styles.fieldDescription} style={{ marginTop: 8 }}>
          Clearing data will remove all workspaces, rules, sessions, and settings.
          This cannot be undone.
        </div>
      </div>
    </div>
  );
}
