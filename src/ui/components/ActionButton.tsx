import styles from './ActionButton.module.css';

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ActionButton({ label, onClick, disabled }: ActionButtonProps) {
  return (
    <button
      class={styles.button}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
