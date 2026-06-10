import styles from './WorkspaceCards.module.css';

export interface WorkspaceCardData {
  id: string;
  name: string;
  icon: string;
  ruleCount: number;
}

interface WorkspaceCardsProps {
  workspaces: WorkspaceCardData[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function WorkspaceCards({ workspaces, activeId, onSelect }: WorkspaceCardsProps) {
  if (workspaces.length === 0) return null;

  return (
    <div class={styles.grid}>
      {workspaces.map(ws => (
        <div
          key={ws.id}
          class={`${styles.card} ${ws.id === activeId ? styles.cardActive : ''}`}
          onClick={() => onSelect(ws.id)}
          role="button"
          tabIndex={0}
        >
          <div class={styles.cardName}>
            {ws.icon && <span class={styles.cardIcon}>{ws.icon}</span>}
            {ws.name}
          </div>
          <div class={styles.cardStats}>
            {ws.ruleCount} {ws.ruleCount === 1 ? 'rule' : 'rules'}
          </div>
        </div>
      ))}
    </div>
  );
}
