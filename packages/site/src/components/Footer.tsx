import { Logo } from '@tabzen/shared/logo';
import { CHROME_STORE_URL, GITHUB_URL } from '../config';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer id="footer" class={styles.footer}>
      <Logo size={14} showText textSize={13} color="#999" />
      <div class={styles.links}>
        <a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>
        <a href="/privacy">Privacy</a>
        <a href={CHROME_STORE_URL} target="_blank" rel="noopener">Chrome Web Store</a>
      </div>
    </footer>
  );
}
