import { Logo } from '@tabzen/shared/logo';
import styles from './Privacy.module.css';

export function Privacy() {
  return (
    <div class={styles.page}>
      <nav class={styles.nav}>
        <a href="/" class={styles.logoLink}>
          <Logo size={20} showText textSize={18} />
        </a>
      </nav>

      <main class={styles.content}>
        <h1>Privacy Policy</h1>
        <p class={styles.updated}>Last updated: March 23, 2026</p>

        <section>
          <h2>Summary</h2>
          <p>
            Tabzen is a Chrome extension that manages your browser tabs. Your data stays on your
            device. We don't run servers, don't collect browsing history, and don't sell data.
            This policy explains exactly what Tabzen stores and why.
          </p>
        </section>

        <section>
          <h2>What Tabzen stores locally</h2>
          <p>All of the following data is stored on your device using Chrome's built-in storage APIs. None of it leaves your browser unless you explicitly enable Google Drive sync.</p>
          <ul>
            <li><strong>Settings and preferences</strong> — your configuration choices (sort order, theme, dedup options). Stored in <code>chrome.storage.sync</code>, which Chrome may sync across your signed-in browsers.</li>
            <li><strong>Grouping rules and priority rules</strong> — the URL patterns you define. Also stored in <code>chrome.storage.sync</code>.</li>
            <li><strong>Workspaces</strong> — workspace names, icons, and associated rules. Stored in <code>chrome.storage.local</code>.</li>
            <li><strong>Saved sessions</strong> — tab URLs, titles, group names, and positions from windows you've saved. Stored in IndexedDB on your device.</li>
            <li><strong>Analytics snapshots</strong> — tab counts, group counts, and top domains, recorded periodically for the insights dashboard. Stored in IndexedDB with a 90-day rolling window. This data never leaves your device.</li>
          </ul>
        </section>

        <section>
          <h2>Google Drive sync (opt-in)</h2>
          <p>
            If you enable Google Drive sync in settings, Tabzen uses Chrome's identity API to
            access a hidden app folder in your Google Drive. This folder is only accessible by Tabzen —
            not by you, other apps, or anyone else.
          </p>
          <p>Tabzen syncs:</p>
          <ul>
            <li>Saved sessions (so you can restore them on another device)</li>
            <li>Exported rule packs</li>
          </ul>
          <p>Tabzen does <strong>not</strong> sync:</p>
          <ul>
            <li>Browsing history</li>
            <li>Analytics data</li>
            <li>Any data beyond what's listed above</li>
          </ul>
          <p>
            You can disable sync at any time in settings. When disabled, no further data is sent
            to Google Drive. Existing backups remain in your Drive until you delete them.
          </p>
        </section>

        <section>
          <h2>Anonymous telemetry (opt-in)</h2>
          <p>
            Tabzen offers optional, anonymous usage telemetry to help improve the extension.
            This is <strong>off by default</strong> and must be explicitly enabled in Settings &gt; Privacy.
          </p>
          <p>If enabled, Tabzen sends anonymous, aggregated data such as:</p>
          <ul>
            <li>Which features are used (e.g., "user sorted tabs")</li>
            <li>General usage patterns (e.g., "user has 40 tabs open")</li>
          </ul>
          <p>Telemetry <strong>never</strong> includes:</p>
          <ul>
            <li>URLs, page titles, or browsing history</li>
            <li>Personal information</li>
            <li>Session or rule content</li>
          </ul>
          <p>You can disable telemetry at any time. No data is sent while it's off.</p>
        </section>

        <section>
          <h2>Permissions</h2>
          <p>Tabzen requests the following Chrome permissions:</p>
          <ul>
            <li><strong>tabs, tabGroups</strong> — to read, group, sort, and manage your tabs</li>
            <li><strong>storage</strong> — to save your settings, rules, and sessions locally</li>
            <li><strong>webNavigation</strong> — to detect duplicate tabs opened via link clicks</li>
            <li><strong>alarms</strong> — to schedule auto-save timers</li>
            <li><strong>notifications</strong> — to confirm before auto-saving</li>
            <li><strong>identity</strong> — to authenticate with Google Drive (only used if sync is enabled)</li>
            <li><strong>contextMenus</strong> — to add right-click tab actions</li>
            <li><strong>sidePanel</strong> — to display the side panel UI</li>
          </ul>
          <p>Tabzen does not request access to any website content. It cannot read page content or inject scripts.</p>
        </section>

        <section>
          <h2>Data you control</h2>
          <p>In Settings &gt; Privacy, you can:</p>
          <ul>
            <li><strong>Export all data</strong> — download everything Tabzen has stored as JSON</li>
            <li><strong>Clear analytics</strong> — delete all local analytics snapshots</li>
            <li><strong>Delete all data</strong> — remove everything and reset to defaults</li>
          </ul>
          <p>Uninstalling the extension deletes all locally stored data automatically.</p>
        </section>

        <section>
          <h2>Third parties</h2>
          <p>
            Tabzen does not share data with any third party. The only external service Tabzen
            communicates with is Google Drive, and only when you enable sync.
          </p>
          <p>
            If you enable telemetry, anonymous data is sent to our analytics provider. No
            personal or browsable data is included.
          </p>
        </section>

        <section>
          <h2>Changes to this policy</h2>
          <p>
            If this policy changes, we'll update the "Last updated" date at the top. For
            significant changes, we'll notify users via the extension's update notes.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions or concerns? Reach out at{' '}
            <a href="mailto:hello@tabzen.io">hello@tabzen.io</a>.
          </p>
        </section>
      </main>

      <footer class={styles.footer}>
        <Logo size={14} showText textSize={13} color="#999" />
        <div class={styles.footerLinks}>
          <a href="/">Home</a>
          <span>Privacy</span>
        </div>
      </footer>
    </div>
  );
}
