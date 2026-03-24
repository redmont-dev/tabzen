import styles from '../App.module.css';

const SHORTCUTS = [
  { command: 'Open Tabzen popup', key: 'Ctrl+Shift+E', mac: 'Cmd+Shift+E' },
  { command: 'Search tabs', key: 'Ctrl+Shift+K', mac: 'Cmd+Shift+K' },
  { command: 'Clean up tabs', key: 'Ctrl+Shift+U', mac: 'Cmd+Shift+U' },
  { command: 'Save current session', key: 'Ctrl+Shift+S', mac: 'Cmd+Shift+S' },
];

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

export function KeyboardShortcutsSection() {
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
            {SHORTCUTS.map(s => (
              <tr key={s.command}>
                <td>{s.command}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{isMac ? s.mac : s.key}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16 }}>
          <div class={styles.fieldDescription}>
            To customize shortcuts, visit{' '}
            <a
              href="chrome://extensions/shortcuts"
              onClick={(e) => {
                e.preventDefault();
                chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
              }}
            >
              chrome://extensions/shortcuts
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
