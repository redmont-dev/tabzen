import styles from '../App.module.css';

export function SyncSection() {
  return (
    <div>
      <h2 class={styles.pageTitle}>Sync</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.fieldDescription} style={{ fontSize: 13, lineHeight: 1.6 }}>
          Google Drive sync is coming soon. This will allow you to back up your
          workspaces, rules, and sessions to the cloud and sync across devices.
        </div>
      </div>
    </div>
  );
}
