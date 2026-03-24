import styles from './FinalCta.module.css';

export function FinalCta() {
  return (
    <section class={styles.section}>
      <h2>
        Stop managing tabs.
        <br />
        <strong>Let Tabzen do it.</strong>
      </h2>
      <p>Free. Open source. No account required. Your data stays on your device.</p>
      <a href="#" class={styles.cta}>
        Add to Chrome
      </a>
    </section>
  );
}
