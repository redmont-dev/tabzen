import type { Settings } from '@/data/types';
import styles from '../App.module.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

export function SessionsSection({ settings, onUpdate }: Props) {
  return (
    <div>
      <h2 class={styles.pageTitle}>Sessions</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Auto-save schedule</div>
            <div class={styles.fieldDescription}>Automatically save sessions on a schedule</div>
          </div>
          <select
            class={styles.select}
            value={settings.autoSaveSchedule}
            onChange={(e) => onUpdate({ autoSaveSchedule: (e.target as HTMLSelectElement).value as Settings['autoSaveSchedule'] })}
          >
            <option value="disabled">Disabled</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
        </div>

        {settings.autoSaveSchedule === 'daily' && (
          <div class={styles.field}>
            <div>
              <div class={styles.fieldLabel}>Daily save time</div>
              <div class={styles.fieldDescription}>Time of day for daily auto-save</div>
            </div>
            <input
              type="time"
              class={styles.input}
              style={{ width: 120 }}
              value={settings.autoSaveDailyTime}
              onChange={(e) => onUpdate({ autoSaveDailyTime: (e.target as HTMLInputElement).value })}
            />
          </div>
        )}

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Save on close</div>
            <div class={styles.fieldDescription}>Automatically save a session when a window with 2+ tabs is closed</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.autoSaveOnClose}
            onChange={(e) => onUpdate({ autoSaveOnClose: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Silent mode</div>
            <div class={styles.fieldDescription}>Don't show a notification when sessions auto-save</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.autoSaveSkipConfirm}
            onChange={(e) => onUpdate({ autoSaveSkipConfirm: (e.target as HTMLInputElement).checked })}
          />
        </div>
      </div>
    </div>
  );
}
