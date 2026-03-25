import { Logo } from '@tabzen/shared/logo';
import { CHROME_STORE_URL, GITHUB_URL } from '../config';
import styles from './Footer.module.css';

function RedmontLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#1a1a1a" />
      <path d="M7 17L12 7l5 10" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" fill="none" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer id="footer" class={styles.footer}>
      <Logo size={14} showText textSize={13} color="#999" />
      <div class={styles.center}>
        <a href="https://redmont.dev" target="_blank" rel="noopener" class={styles.attributionLink}>
          Built by <RedmontLogo /> Redmont
        </a>
      </div>
      <div class={styles.links}>
        <a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
        <a href="/privacy">Privacy</a>
        <a href={CHROME_STORE_URL} target="_blank" rel="noopener">Chrome Web Store</a>
      </div>
    </footer>
  );
}
