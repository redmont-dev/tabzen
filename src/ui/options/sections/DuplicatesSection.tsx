import type { Settings } from '@/data/types';
import styles from '../App.module.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

export function DuplicatesSection({ settings, onUpdate }: Props) {
  return (
    <div>
      <h2 class={styles.pageTitle}>Duplicates</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Enable duplicate detection</div>
            <div class={styles.fieldDescription}>Automatically detect and handle duplicate tabs</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.dedupEnabled}
            onChange={(e) => onUpdate({ dedupEnabled: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Strip URL fragments</div>
            <div class={styles.fieldDescription}>Ignore #hash when comparing URLs</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.stripFragments}
            onChange={(e) => onUpdate({ stripFragments: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Strip trailing slash</div>
            <div class={styles.fieldDescription}>Treat example.com/ and example.com as the same</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.stripTrailingSlash}
            onChange={(e) => onUpdate({ stripTrailingSlash: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Protocol agnostic</div>
            <div class={styles.fieldDescription}>Treat http:// and https:// URLs as the same</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.protocolAgnostic}
            onChange={(e) => onUpdate({ protocolAgnostic: (e.target as HTMLInputElement).checked })}
          />
        </div>
      </div>
    </div>
  );
}
