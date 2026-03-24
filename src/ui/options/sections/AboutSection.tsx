import styles from '../App.module.css';

export function AboutSection() {
  return (
    <div>
      <h2 class={styles.pageTitle}>About</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.aboutVersion}>Tabzen 1.0.0</div>
        <div class={styles.aboutDescription}>
          The tab manager you actually want to use. Organize, group, sort, and manage
          your browser tabs with workspaces, smart rules, session saving, and more.
        </div>
      </div>
    </div>
  );
}
