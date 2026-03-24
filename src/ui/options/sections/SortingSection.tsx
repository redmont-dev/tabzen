import { useState, useCallback } from 'preact/hooks';
import type { Settings, TabGroupColor } from '@/data/types';
import { colorToVar } from '../../components/GroupHeader';
import styles from '../App.module.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

export function SortingSection({ settings, onUpdate }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const order = [...settings.colorOrder];
    const [item] = order.splice(dragIdx, 1);
    order.splice(targetIdx, 0, item);
    onUpdate({ colorOrder: order });
    setDragIdx(null);
  }, [dragIdx, settings.colorOrder, onUpdate]);

  return (
    <div>
      <h2 class={styles.pageTitle}>Sorting</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Default sort method</div>
            <div class={styles.fieldDescription}>How tabs are sorted by default</div>
          </div>
          <select
            class={styles.select}
            value={settings.defaultSortBy}
            onChange={(e) => onUpdate({ defaultSortBy: (e.target as HTMLSelectElement).value as Settings['defaultSortBy'] })}
          >
            <option value="title">Title</option>
            <option value="url">URL</option>
          </select>
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Default sort order</div>
            <div class={styles.fieldDescription}>Ascending or descending</div>
          </div>
          <select
            class={styles.select}
            value={settings.defaultSortOrder}
            onChange={(e) => onUpdate({ defaultSortOrder: (e.target as HTMLSelectElement).value as Settings['defaultSortOrder'] })}
          >
            <option value="asc">Ascending (A-Z)</option>
            <option value="desc">Descending (Z-A)</option>
          </select>
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Group sort mode</div>
            <div class={styles.fieldDescription}>How tab groups are ordered</div>
          </div>
          <select
            class={styles.select}
            value={settings.groupSortMode}
            onChange={(e) => onUpdate({ groupSortMode: (e.target as HTMLSelectElement).value as Settings['groupSortMode'] })}
          >
            <option value="name">By name</option>
            <option value="color">By color order</option>
          </select>
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Collapse after sort</div>
            <div class={styles.fieldDescription}>Collapse all groups after sorting</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.collapseAfterSort}
            onChange={(e) => onUpdate({ collapseAfterSort: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div class={styles.field}>
          <div>
            <div class={styles.fieldLabel}>Remove duplicates on sort</div>
            <div class={styles.fieldDescription}>Automatically close duplicate tabs when sorting</div>
          </div>
          <input
            type="checkbox"
            class={styles.checkbox}
            checked={settings.removeDupsOnSort}
            onChange={(e) => onUpdate({ removeDupsOnSort: (e.target as HTMLInputElement).checked })}
          />
        </div>
      </div>

      <div class={styles.sectionBlock}>
        <div class={styles.sectionLabel}>Color Order</div>
        <div class={styles.fieldDescription} style={{ marginBottom: 12 }}>
          Drag to reorder. Used when group sort mode is set to "By color order".
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {settings.colorOrder.map((color: TabGroupColor, idx: number) => (
            <div
              key={color}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                border: '1px solid var(--border-light)',
                borderRadius: 4,
                cursor: 'grab',
                fontSize: 12,
                background: dragIdx === idx ? 'var(--bg-hover)' : 'transparent',
              }}
            >
              <span class={styles.colorDot} style={{ background: colorToVar(color) }} />
              {color}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
