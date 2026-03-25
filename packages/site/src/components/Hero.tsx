import { CHROME_STORE_URL } from '../config';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section class={styles.hero}>
      <h1>
        Your tabs,
        <br />
        <strong>finally organized.</strong>
      </h1>
      <p class={styles.subtitle}>
        Tabzen groups, searches, and manages your browser tabs so you don't have
        to. Smart rules. Instant search. Zero clutter.
      </p>
      <a href={CHROME_STORE_URL} target="_blank" rel="noopener" class={styles.cta}>
        Add to Chrome — it's free
      </a>
      <div class={styles.subCta}>Works with Chrome and Chromium browsers</div>
    </section>
  );
}
