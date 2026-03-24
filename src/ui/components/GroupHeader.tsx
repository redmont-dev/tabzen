import styles from './GroupHeader.module.css';

interface GroupHeaderProps {
  title: string;
  color: string;
  tabCount: number;
  collapsed: boolean;
  onToggle: () => void;
}

const COLOR_VAR_MAP: Record<string, string> = {
  grey: 'var(--group-grey)',
  blue: 'var(--group-blue)',
  red: 'var(--group-red)',
  yellow: 'var(--group-yellow)',
  green: 'var(--group-green)',
  pink: 'var(--group-pink)',
  purple: 'var(--group-purple)',
  cyan: 'var(--group-cyan)',
  orange: 'var(--group-orange)',
};

export function colorToVar(color: string): string {
  return COLOR_VAR_MAP[color] ?? 'var(--group-grey)';
}

export function GroupHeader({ title, color, tabCount, collapsed, onToggle }: GroupHeaderProps) {
  return (
    <div class={styles.header} onClick={onToggle} role="button" tabIndex={0}>
      <svg
        class={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="3 4.5 6 7.5 9 4.5" />
      </svg>
      <span class={styles.dot} style={{ background: colorToVar(color) }} />
      <span class={styles.title}>{title || 'Untitled'}</span>
      <span class={styles.count}>{tabCount}</span>
    </div>
  );
}
