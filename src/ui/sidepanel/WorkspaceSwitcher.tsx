import styles from './WorkspaceSwitcher.module.css';

interface WorkspaceSwitcherProps {
  activeWorkspace: string;
}

export function WorkspaceSwitcher({ activeWorkspace }: WorkspaceSwitcherProps) {
  // Plan 4 will populate this from WorkspaceManager.
  // For now, always show "Default" as the only workspace.
  return (
    <div class={styles.switcher}>
      <button class={`${styles.pill} ${styles.pillActive}`}>
        {activeWorkspace}
      </button>
    </div>
  );
}
