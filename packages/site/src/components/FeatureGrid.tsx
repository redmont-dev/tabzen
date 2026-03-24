import { useInView } from '../hooks/use-in-view';
import styles from './FeatureGrid.module.css';

const features = [
  {
    title: 'Smart Auto-Grouping',
    desc: 'URL prefix, domain, or regex rules. Your tabs sort themselves into color-coded groups.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="#1a1a1a" stroke-width="1.5" />
        <line x1="10" y1="6" x2="10" y2="10" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" />
        <line x1="10" y1="10" x2="13" y2="13" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    ),
  },
  {
    title: 'Instant Search',
    desc: 'Press \u2318\u21e7K to fuzzy search across all open tabs and saved sessions. Jump anywhere in milliseconds.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="#1a1a1a" stroke-width="1.5" />
        <line x1="6" y1="10" x2="14" y2="10" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    ),
  },
  {
    title: 'Workspaces',
    desc: 'Switch between "Work", "Research", and "Personal" with one click. Each has its own rules and tabs.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="#1a1a1a" stroke-width="1.5" />
        <line x1="10" y1="3" x2="10" y2="17" stroke="#1a1a1a" stroke-width="1.5" />
        <line x1="3" y1="10" x2="17" y2="10" stroke="#1a1a1a" stroke-width="1.5" />
      </svg>
    ),
  },
  {
    title: 'Duplicate Blocker',
    desc: 'Never open the same page twice. Tabzen catches duplicates and switches to the existing tab.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 14l4-4 3 3 5-6" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Sessions',
    desc: 'Save your entire window layout. Restore it later — every tab, every group, every position.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="5" width="14" height="10" rx="1" stroke="#1a1a1a" stroke-width="1.5" />
        <line x1="3" y1="8" x2="17" y2="8" stroke="#1a1a1a" stroke-width="1.5" />
      </svg>
    ),
  },
  {
    title: 'Rule Packs',
    desc: 'Pre-built rule sets for developers, designers, and researchers. Import, export, share with your team.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 17V5l7-3 7 3v12l-7 3-7-3z" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round" />
      </svg>
    ),
  },
  {
    title: 'New Tab Dashboard',
    desc: 'A clean command center replacing your new tab. Workspaces, sessions, stats, and search in one place.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="6" height="6" rx="1" stroke="#1a1a1a" stroke-width="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1" stroke="#1a1a1a" stroke-width="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1" stroke="#1a1a1a" stroke-width="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1" stroke="#1a1a1a" stroke-width="1.5" />
      </svg>
    ),
  },
  {
    title: 'Analytics',
    desc: 'See your tab habits. Top domains, peak counts, dupes blocked. All data stays on your device.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="#1a1a1a" stroke-width="1.5" />
        <path d="M10 6v4l3 2" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    ),
  },
  {
    title: 'Keyboard First',
    desc: 'Full shortcuts for search, sort, save, switch workspaces. Power users never need the mouse.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 10l3 3 7-7" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    ),
  },
];

function FeatureCard({ feature }: { feature: (typeof features)[number] }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div
      ref={ref}
      class={styles.item}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s, transform 0.5s, box-shadow 0.2s',
      }}
    >
      <div class={styles.icon}>{feature.icon}</div>
      <h3>{feature.title}</h3>
      <p>{feature.desc}</p>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <section id="features" class={styles.section}>
      <div class={styles.header}>
        <h2>Less chaos. <strong>More flow.</strong></h2>
        <p>All the tools you need to tame your tabs.</p>
      </div>
      <div class={styles.grid}>
        {features.map((f) => (
          <FeatureCard key={f.title} feature={f} />
        ))}
      </div>
    </section>
  );
}
