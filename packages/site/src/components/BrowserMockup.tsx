import styles from './BrowserMockup.module.css';

export function BrowserMockup() {
  return (
    <div class={styles.frame}>
      <div class={styles.bar}>
        <div class={styles.dot} />
        <div class={styles.dot} />
        <div class={styles.dot} />
        <div class={styles.barTitle}>Tabzen Side Panel</div>
      </div>
      <div class={styles.body}>
        <div class={styles.sidebar}>
          <div class={styles.sbHeader}>
            <span class={styles.sbHeaderTitle}>Tabzen</span>
            <span class={styles.sbHeaderSettings}>Settings</span>
          </div>
          <div class={styles.workspaceTabs}>
            <span class={styles.wsActive}>Work</span>
            <span class={styles.wsInactive}>Research</span>
            <span class={styles.wsInactive}>Personal</span>
          </div>
          <div class={styles.search}>Search tabs... ⌘⇧K</div>
          <div class={styles.quickActions}>
            <span>Clean up</span>
            <span>Save</span>
            <span>Collapse all</span>
          </div>
          <div class={styles.group}>
            <span class={styles.colorDot} style={{ background: 'var(--color-blue)' }} />
            Code
            <span class={styles.groupCount}>7</span>
          </div>
          <div class={styles.tab}>myorg/tab-master</div>
          <div class={styles.tab}>preactjs/preact</div>
          <div class={styles.tabFaded}>5 more</div>
          <div class={styles.group} style={{ marginTop: 6 }}>
            <span class={styles.colorDot} style={{ background: 'var(--color-green)' }} />
            Docs
            <span class={styles.groupCount}>4</span>
          </div>
          <div class={styles.group} style={{ marginTop: 6 }}>
            <span class={styles.colorDot} style={{ background: 'var(--color-purple)' }} />
            Design
            <span class={styles.groupCount}>3</span>
          </div>
          <div class={`${styles.group} ${styles.ungrouped}`} style={{ marginTop: 6 }}>
            <span class={styles.colorDot} style={{ background: '#e0e0e0' }} />
            Ungrouped
            <span class={styles.groupCount}>9</span>
          </div>
        </div>
        <div class={styles.content}>
          <span style={{ fontSize: 12 }}>Your browser content here</span>
        </div>
      </div>
    </div>
  );
}
