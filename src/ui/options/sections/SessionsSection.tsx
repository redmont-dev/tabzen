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
            <div class={styles.fieldLabel}>Countdown timer (seconds)</div>
            <div class={styles.fieldDescription}>Seconds to wait before auto-saving on close</div>
          </div>
          <input
            type="number"
            class={styles.input}
            style={{ width: 80 }}
            min={0}
            max={120}
            value={settings.autoSaveCountdown}
            onChange={(e) => onUpdate({ autoSaveCountdown: parseInt((e.target as HTMLInputElement).value, 10) || 0 })}
          />
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Save on close</div>
            <div class={styles.fieldDescription}>Automatically save session when closing the browser</div>
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
            <div class={styles.fieldDescription}>Skip confirmation when auto-saving</div>
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
