import type { SortBy, SortOrder } from '@/data/types';
import styles from './SortSection.module.css';

interface SortSectionProps {
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSort: (sortBy: SortBy, sortOrder: SortOrder) => void;
}

export function SortSection({ sortBy, sortOrder, onSort }: SortSectionProps) {
  return (
    <div class={styles.section}>
      <div class={styles.label}>Sort</div>
      <div class={styles.row}>
        <button
          class={`${styles.option} ${sortBy === 'title' ? styles.optionActive : ''}`}
          onClick={() => onSort('title', sortOrder)}
        >
          By title
        </button>
        <button
          class={`${styles.option} ${sortBy === 'url' ? styles.optionActive : ''}`}
          onClick={() => onSort('url', sortOrder)}
        >
          By URL
        </button>
        <button
          class={`${styles.option} ${sortOrder === 'asc' ? styles.optionActive : ''}`}
          onClick={() => onSort(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? 'A \u2192 Z' : 'Z \u2192 A'}
        </button>
      </div>
    </div>
  );
}
