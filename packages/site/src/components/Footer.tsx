import { Logo } from '@tabzen/shared/logo';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer id="footer" class={styles.footer}>
      <Logo size={14} showText textSize={13} color="#999" />
      <div class={styles.links}>
        <a href="#">GitHub</a>
        <a href="#">Privacy</a>
        <a href="#">Chrome Web Store</a>
      </div>
    </footer>
  );
}
