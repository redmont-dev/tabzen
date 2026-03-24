import styles from './Reviews.module.css';

const reviews = [
  {
    stars: 5,
    quote:
      '"I had 80+ tabs open and was too scared to close any of them. Installed Tabzen, hit Clean Up, and it grouped everything in seconds. I can actually find things now."',
    name: 'Mark R.',
    source: 'Chrome Web Store',
  },
  {
    stars: 5,
    quote:
      '"The workspace switching is a game changer. I keep Work and Personal completely separate now. No more accidentally sharing my screen with Twitter open."',
    name: 'Sarah K.',
    source: 'Chrome Web Store',
  },
  {
    stars: 5,
    quote:
      '"Finally a tab manager that doesn\'t look like it was designed in 2012. Clean UI, fast, and the keyboard shortcuts mean I never touch my mouse. \u2318\u21e7K is muscle memory now."',
    name: 'James L.',
    source: 'Twitter',
  },
  {
    stars: 4,
    quote:
      '"I only use the auto-grouping and duplicate blocker, but those two features alone are worth it. Saves me from opening the same Jira ticket in 4 tabs."',
    name: 'Priya M.',
    source: 'Chrome Web Store',
  },
  {
    stars: 5,
    quote:
      '"Replaced 3 extensions with this one. Tab grouping, session saving, AND search? The fact that it\'s all local and doesn\'t phone home is the cherry on top."',
    name: 'Alex T.',
    source: 'Reddit',
  },
  {
    stars: 5,
    quote:
      '"Set up the Web Developer rule pack and it just works. GitHub, Stack Overflow, docs — everything goes to the right group automatically. Zero config after that."',
    name: 'Nina W.',
    source: 'Product Hunt',
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div class={styles.stars}>
      {'★'.repeat(count)}
      {'☆'.repeat(5 - count)}
    </div>
  );
}

export function Reviews() {
  return (
    <section id="reviews" class={styles.section}>
      <div class={styles.header}>
        <h2>
          People are <strong>saying things.</strong>
        </h2>
      </div>
      <div class={styles.grid}>
        {reviews.map((r) => (
          <div key={r.name} class={styles.card}>
            <StarRating count={r.stars} />
            <p class={styles.quote}>{r.quote}</p>
            <div class={styles.author}>
              <span class={styles.authorName}>{r.name}</span> · {r.source}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
