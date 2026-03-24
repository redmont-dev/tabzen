import { useInView } from '../hooks/use-in-view';
import styles from './Showcase.module.css';

function FadeIn({ children, class: className }: { children: preact.ComponentChildren; class?: string }) {
  const [ref, inView] = useInView(0.15);
  return (
    <div
      ref={ref}
      class={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
      }}
    >
      {children}
    </div>
  );
}

function SearchVisual() {
  return (
    <div class={styles.visualDark}>
      <div class={styles.searchInner}>
        <div class={styles.searchInput}>
          preact<span style={{ borderRight: '1px solid #e5e5e5', marginLeft: 1 }}>&nbsp;</span>
        </div>
        <div class={styles.searchResultActive}>
          <div>
            <span class={styles.searchHighlight}>preact</span>js/preact
          </div>
          <div class={styles.searchGroup}>
            <span class={styles.colorDot} style={{ background: 'var(--color-blue)' }} />
            <span class={styles.searchGroupLabel}>Code</span>
          </div>
        </div>
        <div class={styles.searchResult}>
          <div style={{ color: '#888' }}>
            <span class={styles.searchHighlight}>preact</span>js.com/guide
          </div>
          <div class={styles.searchGroup}>
            <span class={styles.colorDot} style={{ background: 'var(--color-green)' }} />
            <span class={styles.searchGroupLabel}>Docs</span>
          </div>
        </div>
        <div class={styles.searchHints}>
          &#8593;&#8595; navigate &nbsp; &#8629; switch &nbsp; esc dismiss
        </div>
      </div>
    </div>
  );
}

function WorkspaceVisual() {
  return (
    <div class={styles.visual}>
      <div class={styles.wsInner}>
        <div class={styles.wsTabs}>
          <span class={styles.wsTabActive}>Work</span>
          <span class={styles.wsTabInactive}>Research</span>
          <span class={styles.wsTabInactive}>Personal</span>
          <span class={styles.wsTabAdd}>+</span>
        </div>
        <div class={styles.wsCards}>
          <div class={styles.wsCard}>
            <div class={styles.wsCardTitle}>Work</div>
            <div class={styles.wsCardSub}>23 tabs · 4 groups</div>
          </div>
          <div class={styles.wsCardInactive}>
            <div class={styles.wsCardTitleInactive}>Research</div>
            <div class={styles.wsCardSubInactive}>12 tabs · 2 groups</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RulesVisual() {
  return (
    <div class={styles.visual}>
      <div class={styles.rulesInner}>
        <div class={styles.ruleRow}>
          <div>
            <span class={styles.ruleType}>prefix</span> github.com/myorg
          </div>
          <div class={styles.ruleGroup}>
            <span class={styles.colorDotLarge} style={{ background: 'var(--color-blue)' }} />
            Code
          </div>
        </div>
        <div class={styles.ruleRow}>
          <div>
            <span class={styles.ruleType}>domain</span> *.figma.com
          </div>
          <div class={styles.ruleGroup}>
            <span class={styles.colorDotLarge} style={{ background: 'var(--color-purple)' }} />
            Design
          </div>
        </div>
        <div class={styles.ruleRow}>
          <div>
            <span class={styles.ruleType}>regex</span> jira\.com\/browse\/.*
          </div>
          <div class={styles.ruleGroup}>
            <span class={styles.colorDotLarge} style={{ background: 'var(--color-amber)' }} />
            Tasks
          </div>
        </div>
        <div class={styles.ruleSuggested}>
          Suggested: slack.com &#8594; 4 ungrouped tabs
        </div>
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section id="showcase" class={styles.section}>
      <FadeIn class={styles.row}>
        <div class={styles.text}>
          <h2>
            Find any tab
            <br />
            <strong>in milliseconds.</strong>
          </h2>
          <p>
            Press <span class={styles.kbd}>{'\u2318'}</span>{' '}
            <span class={styles.kbd}>{'\u21e7'}</span>{' '}
            <span class={styles.kbd}>K</span> to search across every open tab
            and saved session. Fuzzy matching means you don't need to remember the
            exact title. Results show which group a tab belongs to.
          </p>
        </div>
        <SearchVisual />
      </FadeIn>

      <FadeIn class={styles.rowReverse}>
        <div class={styles.text}>
          <h2>
            Workspaces keep
            <br />
            <strong>contexts separate.</strong>
          </h2>
          <p>
            Your "Work" tabs don't mix with "Personal". Switch workspaces to load
            a different set of rules, groups, and sessions. Soft switch changes
            rules. Full switch saves your window and opens a fresh one.
          </p>
        </div>
        <WorkspaceVisual />
      </FadeIn>

      <FadeIn class={styles.row}>
        <div class={styles.text}>
          <h2>
            Rules that
            <br />
            <strong>learn your flow.</strong>
          </h2>
          <p>
            Define rules by URL prefix, domain, or regex. Tabzen auto-groups
            matching tabs into named, color-coded groups. When it notices 3+ tabs
            from a domain with no rule, it suggests one.
          </p>
        </div>
        <RulesVisual />
      </FadeIn>
    </section>
  );
}
