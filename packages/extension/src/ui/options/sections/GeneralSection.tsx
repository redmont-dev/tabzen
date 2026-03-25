import type { Settings } from '@/data/types';
import { setTheme } from '../theme';
import styles from '../App.module.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

export function GeneralSection({ settings, onUpdate }: Props) {
  return (
    <div>
      <h2 class={styles.pageTitle}>General</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Theme</div>
            <div class={styles.fieldDescription}>Follow system, or force light/dark</div>
          </div>
          <select
            class={styles.select}
            value={settings.theme}
            onChange={(e) => {
              const theme = (e.target as HTMLSelectElement).value as Settings['theme'];
              setTheme(theme);
              onUpdate({ theme });
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>New tab page</div>
            <div class={styles.fieldDescription}>Replace Chrome's default new tab page with Tabzen dashboard</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.newTabPageEnabled}
            onChange={(e) => onUpdate({ newTabPageEnabled: (e.target as HTMLInputElement).checked })}
          />
        </div>

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
    </div>
  );
}
