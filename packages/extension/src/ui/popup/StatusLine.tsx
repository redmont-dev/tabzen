import styles from './StatusLine.module.css';

interface StatusLineProps {
  tabCount: number;
  groupCount: number;
  workspaceName: string;
  onOpenPanel: () => void;
}

export function StatusLine({ tabCount, groupCount, workspaceName, onOpenPanel }: StatusLineProps) {
  return (
    <div class={styles.status}>
      <span class={styles.title}>Tabzen</span>
      <span class={styles.separator}>/</span>
      <span class={styles.stat}>
        {tabCount} tab{tabCount !== 1 ? 's' : ''}
        {groupCount > 0 && `, ${groupCount} group${groupCount !== 1 ? 's' : ''}`}
      </span>
      <a class={styles.panelLink} onClick={onOpenPanel}>
        Open panel
      </a>
    </div>
  );
}
