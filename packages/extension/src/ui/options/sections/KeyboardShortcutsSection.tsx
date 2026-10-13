import { useCommands, formatShortcut } from '@/hooks/use-commands';
import styles from '../App.module.css';

// Chrome reports commands in manifest order and gives no grouping of its own.
// Order them by how often they get reached for instead.
const DISPLAY_ORDER = [
  'previous-tab',
  '_execute_action',
  'search',
  'clean-up',
  'save-session',
];

const HINTS: Record<string, string> = {
  'previous-tab': 'Press again to come straight back — it toggles between your last two tabs in this window.',
  'save-session': 'Chrome allows only four default shortcuts per extension, so this one ships unbound. Assign it below if you use it often.',
};

function rank(name: string): number {
  const index = DISPLAY_ORDER.indexOf(name);
  return index === -1 ? DISPLAY_ORDER.length : index;
}

export function KeyboardShortcutsSection() {
  const { commands } = useCommands();
  const sorted = [...commands].sort((a, b) => rank(a.name) - rank(b.name));

  return (
    <div>
      <h2 class={styles.pageTitle}>Keyboard Shortcuts</h2>

      <div class={styles.sectionBlock}>
        <table class={styles.rulesTable}>
          <thead>
            <tr>
              <th>Command</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr key={c.name}>
                <td>
                  {c.description || c.name}
                  {HINTS[c.name] && (
                    <div class={styles.fieldDescription}>{HINTS[c.name]}</div>
                  )}
                </td>
                <td
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    opacity: c.shortcut ? 1 : 0.5,
                  }}
                >
                  {formatShortcut(c.shortcut)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16 }}>
          <button
            class={styles.button}
            onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          >
            Change shortcuts
          </button>
          <div class={styles.fieldDescription} style={{ marginTop: 8 }}>
            Chrome keeps keyboard shortcuts under its own control, so rebinding happens
            on its shortcuts page. Any change you make there shows up here automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
