import type { Settings } from '@/data/types';
import { useCommands, shortcutFor, formatShortcut } from '@/hooks/use-commands';
import styles from '../App.module.css';

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

/** The steps cleanUp() runs, in the order it runs them. */
const STEPS: { key: keyof Settings; label: string; description: string }[] = [
  {
    key: 'cleanupDedup',
    label: 'Close duplicate tabs',
    description: 'Keep the first of each repeated URL and close the rest',
  },
  {
    key: 'cleanupGroup',
    label: 'Apply grouping rules',
    description: 'Sort matching tabs into their groups',
  },
  {
    key: 'cleanupSort',
    label: 'Sort tabs',
    description: 'Order tabs within each group using the default sort method',
  },
  {
    key: 'cleanupSortGroups',
    label: 'Sort groups',
    description: 'Order the groups themselves, by name or by color',
  },
  {
    key: 'cleanupCollapse',
    label: 'Collapse all groups',
    description: 'Fold every group closed once everything is in place',
  },
];

export function CleanUpSection({ settings, onUpdate }: Props) {
  const { commands } = useCommands();
  const shortcut = shortcutFor(commands, 'clean-up');

  return (
    <div>
      <h2 class={styles.pageTitle}>Clean Up</h2>

      <div class={styles.sectionBlock}>
        <div class={styles.fieldDescription} style={{ marginBottom: 12 }}>
          Clean up runs these steps in order, on the current window.{' '}
          {shortcut
            ? `Trigger it with ${formatShortcut(shortcut)} or from the popup.`
            : 'Trigger it from the popup, or bind a shortcut under Keyboard Shortcuts.'}
        </div>

        {STEPS.map(step => (
          <div class={styles.field} key={step.key}>
            <div>
              <div class={styles.fieldLabel}>{step.label}</div>
              <div class={styles.fieldDescription}>{step.description}</div>
            </div>
            <input
              type="checkbox"
              class={styles.checkbox}
              checked={Boolean(settings[step.key])}
              onChange={(e) =>
                onUpdate({ [step.key]: (e.target as HTMLInputElement).checked } as Partial<Settings>)
              }
            />
          </div>
        ))}

        {settings.cleanupSortGroups && (
          <div class={styles.field}>
            <div>
              <div class={styles.fieldLabel}>Sort groups by</div>
              <div class={styles.fieldDescription}>
                Shared with the Sorting page. Color order is the list you drag there.
              </div>
            </div>
            <select
              class={styles.select}
              value={settings.groupSortMode}
              onChange={(e) =>
                onUpdate({ groupSortMode: (e.target as HTMLSelectElement).value as Settings['groupSortMode'] })
              }
            >
              <option value="name">Name</option>
              <option value="color">Color order</option>
            </select>
          </div>
        )}
      </div>

      <div class={styles.sectionBlock}>
        <div class={styles.fieldDescription}>
          Ungrouped tabs are always moved to the end, after pinned tabs and groups,
          whichever steps are enabled.
        </div>
      </div>
    </div>
  );
}
