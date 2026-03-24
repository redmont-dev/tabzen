import styles from './ActionList.module.css';

interface Action {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface ActionListProps {
  actions: Action[];
}

export function ActionList({ actions }: ActionListProps) {
  return (
    <div class={styles.list}>
      {actions.map((action) => (
        <button
          key={action.label}
          class={styles.action}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          <span class={styles.actionLabel}>{action.label}</span>
          {action.hint && <span class={styles.actionHint}>{action.hint}</span>}
        </button>
      ))}
    </div>
  );
}
