import { ActionButton } from '../components/ActionButton';
import styles from './QuickActions.module.css';

interface QuickActionsProps {
  onCleanUp: () => void;
  onSave: () => void;
  onCollapseAll: () => void;
}

export function QuickActions({ onCleanUp, onSave, onCollapseAll }: QuickActionsProps) {
  return (
    <div class={styles.row}>
      <ActionButton label="Clean up" onClick={onCleanUp} />
      <ActionButton label="Save" onClick={onSave} />
      <ActionButton label="Collapse all" onClick={onCollapseAll} />
    </div>
  );
}
